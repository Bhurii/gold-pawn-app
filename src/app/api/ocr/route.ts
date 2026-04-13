import { NextRequest, NextResponse } from 'next/server'

function makePrompt() {
  const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
  return `อ่านข้อมูลจากรูปตั๋วจำนำทองนี้ให้ละเอียด
วันที่อัปโหลดคือ ${today} ใช้เดาปีถ้าไม่ชัดเจน
วันที่อาจเขียนแบบย่อ เช่น "31 มีค 69" = 2026-03-31, "1/4/69" = 2026-04-01
ตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่น:
{"ticket_no":"","pawn_date":"YYYY-MM-DD","amount":0,"interest_amounts":[{"amount":0,"date":"YYYY-MM-DD"}],"notes":""}`
}

type StepLog = { name: string; status: 'ok' | 'quota' | 'error' | 'nokey'; reason?: string }

async function callGeminiDirect(model: string, base64: string, mimeType: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw Object.assign(new Error('ไม่มี GEMINI_API_KEY'), { nokey: true })

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
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
    const err = await res.json()
    const msg = err.error?.message || 'Gemini error'
    const isQuota = res.status === 429 || res.status === 503 ||
      msg.toLowerCase().includes('quota') ||
      msg.toLowerCase().includes('exceeded') ||
      msg.toLowerCase().includes('resource_exhausted') ||
      msg.toLowerCase().includes('rate_limit')
    throw Object.assign(new Error(msg), { isQuota })
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function callOpenRouter(model: string, base64: string, mimeType: string): Promise<string> {
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
      model,
      max_tokens: 300,
      messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: 'text', text: makePrompt() }
      ]}]
    })
  })

  if (!res.ok) {
    const errText = await res.text()
    const isQuota = res.status === 429 ||
      errText.toLowerCase().includes('quota') ||
      errText.toLowerCase().includes('rate limit') ||
      errText.toLowerCase().includes('credits') ||
      errText.toLowerCase().includes('insufficient')
    throw Object.assign(new Error(`OR ${res.status}: ${errText.slice(0, 100)}`), { isQuota })
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

function parseJSON(text: string) {
  const clean = text.replace(/```json|```/g, '').trim()
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('ไม่พบ JSON ในคำตอบ')
  return JSON.parse(match[0])
}

export async function POST(req: NextRequest) {
  const { base64, mimeType } = await req.json()
  const log: StepLog[] = []

  const GOOGLE_MODELS = [
    { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (RPD 500/วัน)' },
    { id: 'gemma-3-27b-it', label: 'Gemma 4 31B (RPD 1,500/วัน)' },
    { id: 'gemma-3-12b-it', label: 'Gemma 4 26B A4B (RPD 1,500/วัน)' },
  ]

  const OR_FREE_MODELS = [
    { id: 'nvidia/llama-3.1-nemotron-nano-8b-v1:free', label: 'Nemotron Nano VL (OpenRouter ฟรี — OCR อันดับ 1)' },
    { id: 'google/gemma-3-27b-it:free', label: 'Gemma 3 27B (OpenRouter ฟรี)' },
  ]

  const OR_PAID_MODEL = { id: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (OpenRouter paid)' }

  // ลอง Google AI Studio ทีละตัว
  for (const m of GOOGLE_MODELS) {
    const step: StepLog = { name: m.label, status: 'ok' }
    log.push(step)
    try {
      const text = await callGeminiDirect(m.id, base64, mimeType)
      const parsed = parseJSON(text)
      return NextResponse.json({ success: true, data: parsed, ai_used: m.label, steps: log })
    } catch (e: any) {
      if (e.nokey) { step.status = 'nokey'; step.reason = 'ไม่มี key'; break }
      if (e.isQuota) { step.status = 'quota'; step.reason = 'quota หมด ลองตัวถัดไป' }
      else { step.status = 'error'; step.reason = e.message?.slice(0, 80); break }
    }
  }

  // ลอง OpenRouter Free ทีละตัว
  for (const m of OR_FREE_MODELS) {
    const step: StepLog = { name: m.label, status: 'ok' }
    log.push(step)
    try {
      const text = await callOpenRouter(m.id, base64, mimeType)
      const parsed = parseJSON(text)
      return NextResponse.json({ success: true, data: parsed, ai_used: m.label, steps: log })
    } catch (e: any) {
      if (e.nokey) { step.status = 'nokey'; step.reason = 'ไม่มี key'; break }
      step.status = e.isQuota ? 'quota' : 'error'
      step.reason = e.message?.slice(0, 80)
    }
  }

  // OpenRouter Paid สุดท้าย
  const paidStep: StepLog = { name: OR_PAID_MODEL.label, status: 'ok' }
  log.push(paidStep)
  try {
    const text = await callOpenRouter(OR_PAID_MODEL.id, base64, mimeType)
    const parsed = parseJSON(text)
    return NextResponse.json({ success: true, data: parsed, ai_used: OR_PAID_MODEL.label, steps: log })
  } catch (e: any) {
    paidStep.status = 'error'
    paidStep.reason = e.message?.slice(0, 80)
    return NextResponse.json({
      success: false,
      error: 'AI ทุกตัวไม่พร้อม กรอกข้อมูลเองได้เลย',
      steps: log
    }, { status: 500 })
  }
}
ENDOFFILE
