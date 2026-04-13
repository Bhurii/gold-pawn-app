import { NextRequest, NextResponse } from 'next/server'

function getUploadDate() {
  return new Date().toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}

function makePrompt() {
  return `อ่านข้อมูลจากสลิปตั๋วจำนำทองนี้
วันที่อัปโหลดคือ ${getUploadDate()} ใช้เดาปีถ้าไม่ชัดเจน
วันที่อาจเขียนแบบย่อ เช่น "31 มีค 69" = 2026-03-31
ตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่น:
{"ticket_no":"","pawn_date":"YYYY-MM-DD","amount":0,"interest_amounts":[{"amount":0,"date":"YYYY-MM-DD"}],"notes":""}`
}

async function callGeminiStudio(base64: string, mimeType: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw Object.assign(new Error('NO_GEMINI_KEY'), { isQuota: false, noKey: true })

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`,
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
      msg.toLowerCase().includes('resource_exhausted')
    throw Object.assign(new Error(msg), { status: res.status, isQuota })
  }

  const data = await res.json()
  return data.candidates[0].content.parts[0].text
}

async function callOpenRouter(base64: string, mimeType: string, model: string): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw Object.assign(new Error('NO_OPENROUTER_KEY'), { isQuota: false, noKey: true })

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
      errText.toLowerCase().includes('credits') ||
      errText.toLowerCase().includes('insufficient')
    throw Object.assign(new Error(`OpenRouter ${res.status}: ${errText.slice(0, 100)}`), { isQuota })
  }

  const data = await res.json()
  return data.choices[0].message.content
}

function parseResult(text: string) {
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

export async function POST(req: NextRequest) {
  const { base64, mimeType } = await req.json()
  const log: { step: string; status: 'ok' | 'skip' | 'error'; reason?: string }[] = []

  // Step 1: Google AI Studio — gemini-2.5-flash-lite (free quota)
  try {
    log.push({ step: 'Gemini 2.5 Flash Lite (Google AI Studio ฟรี)', status: 'ok' })
    const text = await callGeminiStudio(base64, mimeType)
    const parsed = parseResult(text)
    return NextResponse.json({ success: true, data: parsed, ai_used: log[0].step, steps: log })
  } catch (e1: any) {
    const reason = e1.noKey ? 'ไม่มี API key' : e1.isQuota ? 'quota หมด' : e1.message?.slice(0, 80)
    log[0].status = e1.isQuota || e1.noKey ? 'skip' : 'error'
    log[0].reason = reason
    if (!e1.isQuota && !e1.noKey) {
      return NextResponse.json({ success: false, error: reason, steps: log }, { status: 500 })
    }
  }

  // Step 2: OpenRouter/free — auto-selects best free vision model
  try {
    log.push({ step: 'OpenRouter/free (vision model ฟรี อัตโนมัติ)', status: 'ok' })
    const text = await callOpenRouter(base64, mimeType, 'openrouter/free')
    const parsed = parseResult(text)
    return NextResponse.json({ success: true, data: parsed, ai_used: log[1].step, steps: log })
  } catch (e2: any) {
    const reason = e2.noKey ? 'ไม่มี API key' : e2.isQuota ? 'quota หมด' : e2.message?.slice(0, 80)
    log[1].status = 'skip'
    log[1].reason = reason
  }

  // Step 3: OpenRouter paid — gemini-2.5-flash-lite
  try {
    log.push({ step: 'OpenRouter gemini-2.5-flash-lite (paid)', status: 'ok' })
    const text = await callOpenRouter(base64, mimeType, 'google/gemini-2.5-flash-lite')
    const parsed = parseResult(text)
    return NextResponse.json({ success: true, data: parsed, ai_used: log[2].step, steps: log })
  } catch (e3: any) {
    log[2].status = 'error'
    log[2].reason = e3.message?.slice(0, 80)
    return NextResponse.json({
      success: false,
      error: 'AI ทุกตัวไม่พร้อมใช้งาน กรอกข้อมูลเองได้เลย',
      steps: log
    }, { status: 500 })
  }
}
