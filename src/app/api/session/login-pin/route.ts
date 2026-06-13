import { NextRequest, NextResponse } from 'next/server'
import { applySessionCookie, SessionUser, SessionUserRole } from '@/lib/server/app-session'
import { hitRateLimit } from '@/lib/server/rate-limit'
import { verifyAgentPin, verifyOwnerPin } from '@/lib/server/settings-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getClientKey(request: NextRequest) {
  return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'local'
}

function buildUser(role: SessionUserRole): SessionUser {
  if (role === 'owner') {
    return { id: 'owner', role: 'owner', display_name: 'โทนี่', auth_type: 'pin' }
  }

  return { id: 'agent', role: 'agent', display_name: 'เจ้หลุยส์', auth_type: 'pin' }
}

export async function POST(request: NextRequest) {
  try {
    const limiter = hitRateLimit(`login-pin:${getClientKey(request)}`, 10, 10 * 60 * 1000)
    if (!limiter.allowed) {
      return NextResponse.json({ error: 'ลองใหม่อีกครั้งในภายหลัง' }, { status: 429 })
    }

    const body = await request.json().catch(() => null)
    const mode = body?.mode === 'owner' ? 'owner' : body?.mode === 'agent' ? 'agent' : null
    const pin = typeof body?.pin === 'string' ? body.pin.trim() : ''

    if (!mode || !/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
    }

    const valid = mode === 'owner' ? await verifyOwnerPin(pin) : await verifyAgentPin(pin)
    if (!valid) {
      return NextResponse.json({ error: mode === 'owner' ? 'PIN โทนี่ไม่ถูกต้อง' : 'PIN ไม่ถูกต้อง' }, { status: 401 })
    }

    const user = buildUser(mode)
    const response = NextResponse.json({ user })
    applySessionCookie(response, user)
    return response
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
