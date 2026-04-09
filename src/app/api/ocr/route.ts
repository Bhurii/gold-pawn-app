import { NextRequest, NextResponse } from 'next/server'

async function callGemini(base64: string, mimeType: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
    throw Object.assign(new Error(err.error?.message), { status: res.status })
  }
  const data = await res.json()
  return data.candidates[0].content.parts[0].text
}

async function callOpenRouter(base64: string, mimeType: string) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
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

export async function POST(req: NextRequest) {
  try {
    const { base64, mimeType } = await req.json()
    let text: string
    try {
      text = await callGemini(base64, mimeType)
    } catch (err: any) {
      if (err.status === 429 || err.status === 503) {
        text = await callOpenRouter(base64, mimeType)
      } else throw err
    }
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json({ success: true, data: parsed })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
