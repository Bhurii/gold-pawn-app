import { NextRequest, NextResponse } from 'next/server'

const PROMPT = `อ่านข้อมูลจากสลิปตั๋วจำนำทองนี้ให้ละเอียด
วันที่ในตั๋วอาจเขียนแบบย่อด้วยลายมือ เช่น "31 มีค 69" หมายถึง 31 มีนาคม 2569 (พ.ศ.)
ให้แปลงวันที่เป็น ค.ศ. รูปแบบ YYYY-MM-DD เสมอ เช่น 31 มีค 69 = 2026-03-31
ตัวเลขปีในตั๋วถ้าเป็น 2 หลัก เช่น 69 = พ.ศ. 2569 = ค.ศ. 2026
ตัวเลขปีในตั๋วถ้าเป็น 4 หลัก เช่น 2569 = พ.ศ. 2569 = ค.ศ. 2026

ตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่น:
{"ticket_no":"เลขที่ตั๋ว","pawn_date":"YYYY-MM-DD","amount":0,"interest_amounts":[{"amount":0,"date":"YYYY-MM-DD"}],"notes":""}`

async function callGemini(base64: string, mimeType: string) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw Object.assign(new Error('NO_GEMINI_KEY'), { fallback: true })
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: PROMPT }] }],
        generationConfig: { maxOutputTokens: 256 }
      })
    }
  )
  if (!res.ok) {
    const err = await res.json()
    const msg = err.error?.message || 'Gemini error'
    const status = res.status
    const needFallback = status === 429 || status === 503 ||
      msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('exceeded')
    throw Object.assign(new Error(msg), { status, fallback: needFallback })
  }
  const data = await res.json()
  return data.candidates[0].content.parts[0].text
}

async function callOpenRouter(base64: string, mimeType: string) {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY not set')
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': 'https://gold-pawn-app.vercel.app',
      'X-Title': 'Gold Pawn App',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-lite-001',
      max_tokens: 256,
      messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }, { type: 'text', text: PROMPT }] }]
    })
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenRouter HTTP ${res.status}: ${errText}`)
  }
  const data = await res.json()
  return data.choices[0].message.content
}

export async function POST(req: NextRequest) {
  let aiUsed = 'none'
  let geminiError = ''
  try {
    const { base64, mimeType } = await req.json()
    let text: string
    try {
      text = await callGemini(base64, mimeType)
      aiUsed = 'Gemini Flash Lite (free)'
    } catch (err: any) {
      geminiError = err.message
      if (err.fallback) {
        text = await callOpenRouter(base64, mimeType)
        aiUsed = 'OpenRouter — Gemini Flash Lite'
      } else throw err
    }
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json({ success: true, data: parsed, ai_used: aiUsed })
  } catch (e: any) {
    return NextResponse.json({
      success: false, error: e.message, ai_used: aiUsed,
      gemini_key_exists: !!process.env.GEMINI_API_KEY,
      openrouter_key_exists: !!process.env.OPENROUTER_API_KEY
    }, { status: 500 })
  }
}
