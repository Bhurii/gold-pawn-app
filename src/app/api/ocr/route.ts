import { NextRequest, NextResponse } from 'next/server'

function makePrompt() {
  const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
  return `อ่านข้อมูลจากรูปตั๋วจำนำทองนี้
วันที่อัปโหลดคือ ${today} ใช้เดาปีถ้าไม่ชัดเจน
วันที่อาจเขียนแบบย่อ เช่น "31 มีค 69" = 2026-03-31
ตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่น:
{"ticket_no":"","pawn_date":"YYYY-MM-DD","amount":0,"interest_amounts":[{"amount":0,"date":"YYYY-MM-DD"}],"notes":""}`
}

type StepLog = { name: string; status: 'ok'|'quota'|'error'|'nokey'; reason?: string }

async function callGemini(modelId: string, base64: string, mimeType: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw Object.assign(new Error('ไม่มี GEMINI_API_KEY'), { nokey: true })
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: makePrompt() }
        ]}],
        generationConfig: { maxOutputTokens: 300 }
      })
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err.error?.message || `HTTP ${res.status}`
    const isQuota = res.status === 429 || res.status === 503 ||
      msg.toLowerCase().includes('quota') ||
      msg.toLowerCase().includes('exceeded') ||
      msg.toLowerCase().includes('resource_exhausted') ||
      msg.toLowerCase().includes('rate')
    throw Object.assign(new Error(msg.slice(0, 120)), { isQuota })
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function callOR(modelId: string, base64: string, mimeType: string): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw Object.assign(new Error('ไม่มี OPENROUTER_API_KEY'), { nokey: true })
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': 'https://gold-pawn-app.vercel.app',
      'X-Title': 'Gold Pawn App',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 300,
      messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: 'text', text: makePrompt() }
      ]}]
    })
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    const isQuota = res.status === 429 ||
      errText.toLowerCase().includes('quota') ||
      errText.toLowerCase().includes('rate') ||
      errText.toLowerCase().includes('credits') ||
      errText.toLowerCase().includes('insufficient') ||
      errText.toLowerCase().includes('free limit')
    throw Object.assign(new Error(`OR ${res.status}: ${errText.slice(0, 100)}`), { isQuota })
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

function parseJSON(text: string) {
  const clean = text.replace(/```json|```/g, '').trim()
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('ไม่พบ JSON')
  return JSON.parse(match[0])
}

export async function POST(req: NextRequest) {
  const { base64, mimeType } = await req.json()
  const log: StepLog[] = []

  const queue: { fn: () => Promise<string>; name: string; skipOnNoKey?: 'google'|'or' }[] = [
    {
      name: 'Gemini 2.5 Flash (Google AI Studio ฟรี)',
      fn: () => callGemini('gemini-2.5-flash', base64, mimeType),
      skipOnNoKey: 'google'
    },
    {
      name: 'Gemini 2.5 Flash Lite (Google AI Studio ฟรี)',
      fn: () => callGemini('gemini-2.5-flash-lite', base64, mimeType),
      skipOnNoKey: 'google'
    },
    {
      name: 'Nemotron Nano 12B v2 VL (OpenRouter ฟรี — OCR อันดับ 1)',
      fn: () => callOR('nvidia/nemotron-nano-12b-v2-vl:free', base64, mimeType),
      skipOnNoKey: 'or'
    },
    {
      name: 'Gemma 4 31B (OpenRouter ฟรี — backup)',
      fn: () => callOR('google/gemma-4-31b-it:free', base64, mimeType),
      skipOnNoKey: 'or'
    },
    {
      name: 'Gemini 2.5 Flash Lite (OpenRouter paid)',
      fn: () => callOR('google/gemini-2.5-flash-lite', base64, mimeType),
      skipOnNoKey: 'or'
    },
  ]

  let googleKeyMissing = false
  let orKeyMissing = false

  for (const item of queue) {
    if (item.skipOnNoKey === 'google' && googleKeyMissing) continue
    if (item.skipOnNoKey === 'or' && orKeyMissing) continue

    const step: StepLog = { name: item.name, status: 'ok' }
    log.push(step)

    try {
      const text = await item.fn()
      if (!text.trim()) throw new Error('ได้ response ว่าง')
      const parsed = parseJSON(text)
      return NextResponse.json({ success: true, data: parsed, ai_used: item.name, steps: log })
    } catch (e: any) {
      if (e.nokey) {
        step.status = 'nokey'
        step.reason = 'ไม่มี API key'
        if (item.skipOnNoKey === 'google') googleKeyMissing = true
        if (item.skipOnNoKey === 'or') orKeyMissing = true
        continue
      }
      step.status = e.isQuota ? 'quota' : 'error'
      step.reason = e.message?.slice(0, 100)
    }
  }

  return NextResponse.json({
    success: false,
    error: 'AI ทุกตัวไม่พร้อมใช้งาน กรอกข้อมูลเองได้เลย',
    steps: log
  }, { status: 500 })
}
