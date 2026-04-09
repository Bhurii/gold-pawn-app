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
    throw Object.assign(new Error(msg), { status: res.status })
  }
  const data = await res.json()
  return data.candidates[0].content.parts[0].text
}

async function callOpenRouter(base64: string, mimeType: string) {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('NO_OPENROUTER_KEY')
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
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenRouter HTTP ${res.status}: ${errText}`)
  }
  const data = await res.json()
  return data.choices[0].message.content
}

function shouldFallback(err: any): boolean {
  if (err.message === 'NO_GEMINI_KEY') return true
  if (err.status === 429 || err.status === 503) return true
  const msg = err.message?.toLowerCase() || ''
  return msg.includes('quota') || msg.includes('exceeded') || msg.includes('limit')
}

export async function POST(req: NextRequest) {
  let aiUsed = 'none'
  try {
    const { base64, mimeType } = await req.json()
    let text: string
    let geminiError = ''

    try {
      text = await callGemini(base64, mimeType)
      aiUsed = 'Gemini 2.0 Flash'
    } catch (err: any) {
      geminiError = err.message
      if (shouldFallback(err)) {
        text = await callOpenRouter(base64, mimeType)
        aiUsed = 'OpenRouter (Gemini fallback)'
      } else {
        throw Object.assign(err, { gemini_error: geminiError })
      }
    }

    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json({ 
      success: true, 
      data: parsed, 
      ai_used: aiUsed 
    })
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e.message,
      ai_used: aiUsed,
      gemini_key_exists: !!process.env.GEMINI_API_KEY,
      openrouter_key_exists: !!process.env.OPENROUTER_API_KEY
    }, { status: 500 })
  }
}
