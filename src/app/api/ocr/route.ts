import { NextRequest, NextResponse } from 'next/server'

async function callGemini(base64: string, mimeType: string) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('NO_GEMINI_KEY')
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: 'อ่านข้อมูลจากสลิปตั๋วจำนำทองนี้ให้ละเอียด ตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่น:\n{"ticket_no":"เลขที่ตั๋ว","pawn_date":"YYYY-MM-DD","amount":0,"interest_amounts":[{"amount":0,"date":"YYYY-MM-DD"}],"notes":""}' }
          ]
        }]
      })
    }
  )
  if (!res.ok) {
    const err = await res.json()
    const msg = err.error?.message || 'Gemini error'
    const status = res.status
    throw Object.assign(new Error(msg), { status })
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
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: 'text', text: 'อ่านข้อมูลจากสลิปตั๋วจำนำทองนี้ให้ละเอียด ตอบเป็น JSON เท่านั้น:\n{"ticket_no":"เลขที่ตั๋ว","pawn_date":"YYYY-MM-DD","amount":0,"interest_amounts":[{"amount":0,"date":"YYYY-MM-DD"}],"notes":""}' }
        ]
      }]
    })
  })
  if (!res.ok) throw new Error('OpenRouter error')
  const data = await res.json()
  return data.choices[0].message.content
}

function shouldFallback(err: any): boolean {
  if (err.message === 'NO_GEMINI_KEY') return true
  if (err.status === 429 || err.status === 503) return true
  const msg = err.message?.toLowerCase() || ''
  if (msg.includes('quota') || msg.includes('exceeded') || msg.includes('limit')) return true
  return false
}

export async function POST(req: NextRequest) {
  try {
    const { base64, mimeType } = await req.json()
    let text: string
    let usedFallback = false

    try {
      text = await callGemini(base64, mimeType)
    } catch (err: any) {
      if (shouldFallback(err)) {
        text = await callOpenRouter(base64, mimeType)
        usedFallback = true
      } else {
        throw err
      }
    }

    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json({ success: true, data: parsed, used_fallback: usedFallback })
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e.message,
      gemini_key_exists: !!process.env.GEMINI_API_KEY,
      openrouter_key_exists: !!process.env.OPENROUTER_API_KEY
    }, { status: 500 })
  }
}
