import { NextRequest, NextResponse } from 'next/server'
import { readSessionFromRequest } from '@/lib/server/app-session'
import { hitRateLimit } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type StepLog = {
  name: string
  status: 'ok' | 'quota' | 'error' | 'nokey'
  reason?: string
}

type OcrMode = 'ticket' | 'transfer'

const MAX_BASE64_IMAGE_LENGTH = 12_000_000
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

function getClientKey(request: NextRequest) {
  return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'local'
}

function makeTicketPrompt() {
  const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
  return `อ่านข้อมูลจากรูปตั๋วจำนำทองนี้
วันนี้คือ ${today}

เป้าหมายคืออ่านข้อมูล "ตั๋วใหม่" ให้มากที่สุด:
- ticket_no = เลขตั๋วใหม่
- pawn_date = วันที่ทำการบนตั๋วใหม่
- amount = ยอดเงินบนตั๋วใหม่

ถ้าวันที่อ่านได้ชัด ให้ใส่ date_confidence = "clear"
ถ้าวันที่อ่านไม่ชัด แต่พอใช้วันที่วันนี้ช่วยเดา "วันที่ที่น่าจะเป็น" ได้ ให้ใส่ date_confidence = "suggested"
และใส่ pawn_date เป็นวันที่แนะนำ พร้อม date_note อธิบายสั้น ๆ
ถ้าวันที่หาไม่ได้จริง ๆ ให้ใส่ date_confidence = "unknown" และ pawn_date = ""

ถ้าในรูปมีทั้งใบเก่าและใบใหม่ ให้เน้นอ่าน "ใบใหม่"
ตอบเป็น JSON เท่านั้น:
{"ticket_no":"","pawn_date":"YYYY-MM-DD","amount":0,"date_confidence":"clear|suggested|unknown","date_note":"","interest_amounts":[{"amount":0,"date":"YYYY-MM-DD"}],"notes":""}`
}

function makeTransferPrompt() {
  return `อ่านข้อความจากสลิปโอนเงินนี้ แล้วตอบเป็น JSON เท่านั้น

เป้าหมาย:
- amount = ยอดเงินที่โอนจริงบนสลิป
- transfer_date = วันที่บนสลิป ถ้าอ่านไม่ออกให้เป็น ""
- transfer_time = เวลา ถ้าอ่านไม่ออกให้เป็น ""
- receiver_name = ชื่อผู้รับ ถ้าอ่านได้
- notes = ข้อสังเกตสั้น ๆ

ตอบเป็น JSON เท่านั้น:
{"amount":0,"transfer_date":"YYYY-MM-DD","transfer_time":"","receiver_name":"","notes":""}`
}

function makePrompt(mode: OcrMode) {
  return mode === 'transfer' ? makeTransferPrompt() : makeTicketPrompt()
}

function validatePayload(base64: unknown, mimeType: unknown): { base64: string; mimeType: string } {
  if (typeof base64 !== 'string' || !base64) {
    throw new Error('Missing image data')
  }
  if (base64.length > MAX_BASE64_IMAGE_LENGTH) {
    throw new Error('Image is too large')
  }
  if (typeof mimeType !== 'string' || !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error('Unsupported image type')
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(base64)) {
    throw new Error('Invalid image data')
  }
  return { base64, mimeType }
}

async function callGemini(modelId: string, base64: string, mimeType: string, prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw Object.assign(new Error('Missing GEMINI_API_KEY'), { nokey: true })

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: prompt },
          ],
        }],
        generationConfig: { maxOutputTokens: 400 },
      }),
    },
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err.error?.message || `HTTP ${res.status}`
    const lower = msg.toLowerCase()
    const isQuota = res.status === 429 || res.status === 503 || lower.includes('quota') || lower.includes('rate') || lower.includes('resource_exhausted')
    throw Object.assign(new Error(msg.slice(0, 140)), { isQuota })
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function callOpenRouter(modelId: string, base64: string, mimeType: string, prompt: string): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw Object.assign(new Error('Missing OPENROUTER_API_KEY'), { nokey: true })

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': 'https://gold-pawn-app.vercel.app',
      'X-Title': 'Gold Pawn App',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    const lower = errText.toLowerCase()
    const isQuota = res.status === 429 || lower.includes('quota') || lower.includes('rate') || lower.includes('credits') || lower.includes('insufficient') || lower.includes('free limit')
    throw Object.assign(new Error(`OR ${res.status}: ${errText.slice(0, 120)}`), { isQuota })
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

function parseJSON(text: string) {
  const clean = text.replace(/```json|```/g, '').trim()
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON found')
  return JSON.parse(match[0])
}

export async function POST(req: NextRequest) {
  const user = readSessionFromRequest(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const limiter = hitRateLimit(`ocr:${getClientKey(req)}`, 12, 10 * 60 * 1000)
  if (!limiter.allowed) {
    return NextResponse.json({ success: false, error: 'ลองใหม่อีกครั้งในภายหลัง' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const mode: OcrMode = body?.mode === 'transfer' ? 'transfer' : 'ticket'

  let payload: { base64: string; mimeType: string }
  try {
    payload = validatePayload(body?.base64, body?.mimeType)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid request'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }

  const { base64, mimeType } = payload
  const prompt = makePrompt(mode)
  const log: StepLog[] = []

  const queue: Array<{ name: string; fn: () => Promise<string>; skipOnNoKey?: 'google' | 'or' }> = [
    {
      name: 'Gemini 2.5 Flash',
      fn: () => callGemini('gemini-2.5-flash', base64, mimeType, prompt),
      skipOnNoKey: 'google',
    },
    {
      name: 'Gemini 2.5 Flash Lite',
      fn: () => callGemini('gemini-2.5-flash-lite', base64, mimeType, prompt),
      skipOnNoKey: 'google',
    },
    {
      name: 'Nemotron Nano 12B v2 VL',
      fn: () => callOpenRouter('nvidia/nemotron-nano-12b-v2-vl:free', base64, mimeType, prompt),
      skipOnNoKey: 'or',
    },
    {
      name: 'Gemma 4 31B',
      fn: () => callOpenRouter('google/gemma-4-31b-it:free', base64, mimeType, prompt),
      skipOnNoKey: 'or',
    },
    {
      name: 'Gemini 2.5 Flash Lite (OpenRouter)',
      fn: () => callOpenRouter('google/gemini-2.5-flash-lite', base64, mimeType, prompt),
      skipOnNoKey: 'or',
    },
  ]

  let googleKeyMissing = false
  let openRouterKeyMissing = false

  for (const item of queue) {
    if (item.skipOnNoKey === 'google' && googleKeyMissing) continue
    if (item.skipOnNoKey === 'or' && openRouterKeyMissing) continue

    const step: StepLog = { name: item.name, status: 'ok' }
    log.push(step)

    try {
      const text = await item.fn()
      if (!text.trim()) throw new Error('Empty response')

      const parsed = parseJSON(text)
      return NextResponse.json({ success: true, data: parsed, ai_used: item.name, steps: log, mode })
    } catch (e) {
      const err = e as Error & { nokey?: boolean; isQuota?: boolean }
      if (err.nokey) {
        step.status = 'nokey'
        step.reason = 'Missing API key'
        if (item.skipOnNoKey === 'google') googleKeyMissing = true
        if (item.skipOnNoKey === 'or') openRouterKeyMissing = true
        continue
      }

      step.status = err.isQuota ? 'quota' : 'error'
      step.reason = err.message?.slice(0, 120)
    }
  }

  return NextResponse.json(
    {
      success: false,
      error: mode === 'transfer' ? 'AI อ่านสลิปไม่สำเร็จ ลองกรอกยอดเองได้เลย' : 'AI ไม่พร้อมใช้งาน กรอกข้อมูลเองได้เลย',
      steps: log,
      mode,
    },
    { status: 500 },
  )
}
