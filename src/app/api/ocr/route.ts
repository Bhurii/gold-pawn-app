import { NextRequest, NextResponse } from 'next/server'

function makePrompt() {
  const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
<<<<<<< HEAD
  return `อ่านข้อมูลจากรูปตั๋วจำนำทองนี้
วันที่อัปโหลดคือ ${today} ใช้เดาปีถ้าไม่ชัดเจน
วันที่อาจเขียนแบบย่อ เช่น "31 มีค 69" = 2026-03-31
=======
  return `อ่านข้อมูลจากรูปตั๋วจำนำทองนี้ให้ละเอียด
วันที่อัปโหลดคือ ${today} ใช้เดาปีถ้าไม่ชัดเจน
วันที่อาจเขียนแบบย่อ เช่น "31 มีค 69" = 2026-03-31, "1/4/69" = 2026-04-01
>>>>>>> a3b64119f4d4447853eef8df48ce691ca70968cd
ตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่น:
{"ticket_no":"","pawn_date":"YYYY-MM-DD","amount":0,"interest_amounts":[{"amount":0,"date":"YYYY-MM-DD"}],"notes":""}`
}

<<<<<<< HEAD
type StepLog = { name: string; status: 'ok'|'quota'|'error'|'nokey'; reason?: string }
=======
type StepLog = { name: string; status: 'ok' | 'quota' | 'error' | 'nokey'; reason?: string }

async function callGeminiDirect(model: string, base64: string, mimeType: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw Object.assign(new Error('ไม่มี GEMINI_API_KEY'), { nokey: true })
>>>>>>> a3b64119f4d4447853eef8df48ce691ca70968cd

async function callGemini(modelId: string, base64: string, mimeType: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw Object.assign(new Error('ไม่มี GEMINI_API_KEY'), { nokey: true })
  const res = await fetch(
<<<<<<< HEAD
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`,
=======
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
>>>>>>> a3b64119f4d4447853eef8df48ce691ca70968cd
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
<<<<<<< HEAD
      msg.toLowerCase().includes('rate')
    throw Object.assign(new Error(msg.slice(0, 120)), { isQuota })
=======
      msg.toLowerCase().includes('rate_limit')
    throw Object.assign(new Error(msg), { isQuota })
>>>>>>> a3b64119f4d4447853eef8df48ce691ca70968cd
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

<<<<<<< HEAD
async function callOR(modelId: string, base64: string, mimeType: string): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw Object.assign(new Error('ไม่มี OPENROUTER_API_KEY'), { nokey: true })
=======
async function callOpenRouter(model: string, base64: string, mimeType: string): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw Object.assign(new Error('ไม่มี OPENROUTER_API_KEY'), { nokey: true })

>>>>>>> a3b64119f4d4447853eef8df48ce691ca70968cd
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
<<<<<<< HEAD
      errText.toLowerCase().includes('rate') ||
      errText.toLowerCase().includes('credits') ||
      errText.toLowerCase().includes('insufficient') ||
      errText.toLowerCase().includes('free limit')
=======
      errText.toLowerCase().includes('rate limit') ||
      errText.toLowerCase().includes('credits') ||
      errText.toLowerCase().includes('insufficient')
>>>>>>> a3b64119f4d4447853eef8df48ce691ca70968cd
    throw Object.assign(new Error(`OR ${res.status}: ${errText.slice(0, 100)}`), { isQuota })
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

function parseJSON(text: string) {
  const clean = text.replace(/```json|```/g, '').trim()
  const match = clean.match(/\{[\s\S]*\}/)
<<<<<<< HEAD
  if (!match) throw new Error('ไม่พบ JSON')
=======
  if (!match) throw new Error('ไม่พบ JSON ในคำตอบ')
>>>>>>> a3b64119f4d4447853eef8df48ce691ca70968cd
  return JSON.parse(match[0])
}

export async function POST(req: NextRequest) {
  const { base64, mimeType } = await req.json()
  const log: StepLog[] = []

<<<<<<< HEAD
  // คิวทั้งหมด — ลองทุกตัวตามลำดับ ไม่ break กลางทาง
  const queue: { fn: () => Promise<string>; name: string; skipOnNoKey?: 'google'|'or' }[] = [
    // Google AI Studio — ฟรี เรียงตาม RPD/ความสามารถ
    {
      name: 'Gemini 2.5 Flash (Google AI Studio ฟรี)',
      fn: () => callGemini('gemini-2.5-flash', base64, mimeType),
      skipOnNoKey: 'google'
    },
    {
      name: 'Gemini 3 Flash Preview (Google AI Studio ฟรี)',
      fn: () => callGemini('gemini-3-flash-preview-05-20', base64, mimeType),
      skipOnNoKey: 'google'
    },
    {
      name: 'Gemini 2.5 Flash Lite (Google AI Studio ฟรี)',
      fn: () => callGemini('gemini-2.5-flash-lite', base64, mimeType),
      skipOnNoKey: 'google'
    },
    // OpenRouter Free — เรียงตาม OCR performance
    {
      name: 'Nemotron Nano 12B v2 VL (OpenRouter ฟรี — OCR อันดับ 1)',
      fn: () => callOR('nvidia/nemotron-nano-12b-v2-vl:free', base64, mimeType),
      skipOnNoKey: 'or'
    },
    {
      name: 'Gemma 4 31B (OpenRouter ฟรี)',
      fn: () => callOR('google/gemma-4-31b-it:free', base64, mimeType),
      skipOnNoKey: 'or'
    },
    {
      name: 'Gemma 4 26B A4B (OpenRouter ฟรี)',
      fn: () => callOR('google/gemma-4-26b-a4b-it:free', base64, mimeType),
      skipOnNoKey: 'or'
    },
    // OpenRouter Paid — สุดท้าย
    {
      name: 'Gemini 2.5 Flash Lite (OpenRouter paid)',
      fn: () => callOR('google/gemini-2.5-flash-lite', base64, mimeType),
      skipOnNoKey: 'or'
    },
  ]

  let googleKeyMissing = false
  let orKeyMissing = false

  for (const item of queue) {
    // ข้ามถ้าไม่มี key ของ provider นั้น
    if (item.skipOnNoKey === 'google' && googleKeyMissing) continue
    if (item.skipOnNoKey === 'or' && orKeyMissing) continue

    const step: StepLog = { name: item.name, status: 'ok' }
    log.push(step)

    try {
      const text = await item.fn()
      if (!text.trim()) throw new Error('ได้ response ว่าง')
      const parsed = parseJSON(text)
      return NextResponse.json({
        success: true,
        data: parsed,
        ai_used: item.name,
        steps: log
      })
    } catch (e: any) {
      if (e.nokey) {
        step.status = 'nokey'
        step.reason = 'ไม่มี API key'
        if (item.skipOnNoKey === 'google') googleKeyMissing = true
        if (item.skipOnNoKey === 'or') orKeyMissing = true
        continue // ข้ามทุก item ของ provider นี้
      }
      // quota หรือ error อื่น → ลองตัวถัดไปเสมอ
      step.status = e.isQuota ? 'quota' : 'error'
      step.reason = e.message?.slice(0, 100)
      // ไม่ break — ลองต่อ
    }
  }

  return NextResponse.json({
    success: false,
    error: 'AI ทุกตัวไม่พร้อมใช้งาน กรอกข้อมูลเองได้เลย',
    steps: log
  }, { status: 500 })
=======
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
>>>>>>> a3b64119f4d4447853eef8df48ce691ca70968cd
}
