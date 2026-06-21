import { NextRequest, NextResponse } from 'next/server'
import { applySessionCookie, SessionUser, SessionUserRole } from '@/lib/server/app-session'
import { hitRateLimit } from '@/lib/server/rate-limit'
import { verifyAgentPin, verifyOwnerPin, verifyPhatPin } from '@/lib/server/settings-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getClientKey(request: NextRequest) {
  return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'local'
}

function buildUser(role: SessionUserRole): SessionUser {
  if (role === 'owner') {
    return { id: 'owner', role: 'owner', user_key: 'tony', display_name: 'โทนี่', auth_type: 'pin' }
  }

  if (role === 'agent') {
    return { id: 'agent', role: 'agent', user_key: 'louise', display_name: 'เจ้หลุยส์', auth_type: 'pin' }
  }

  return { id: 'viewer', role: 'viewer', user_key: 'phat', display_name: 'เจ้ภัส', auth_type: 'pin' }
}

export async function POST(request: NextRequest) {
  try {
    const limiter = hitRateLimit(`login-pin:${getClientKey(request)}`, 10, 10 * 60 * 1000)
    if (!limiter.allowed) {
      return NextResponse.json({ error: 'ลองใหม่อีกครั้งในภายหลัง' }, { status: 429 })
    }

    const body = await request.json().catch(() => null)
    const mode = body?.mode === 'owner' ? 'owner' : body?.mode === 'agent' ? 'agent' : body?.mode === 'viewer' ? 'viewer' : null
    const pin = typeof body?.pin === 'string' ? body.pin.trim() : ''

    if (!mode || !/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
    }

    const valid = mode === 'owner'
      ? await verifyOwnerPin(pin)
      : mode === 'agent'
        ? await verifyAgentPin(pin)
        : await verifyPhatPin(pin)

    if (!valid) {
      return NextResponse.json({
        error: mode === 'owner' ? 'PIN โทนี่ไม่ถูกต้อง' : mode === 'agent' ? 'PIN เจ้หลุยส์ไม่ถูกต้อง' : 'PIN เจ้ภัสไม่ถูกต้อง',
      }, { status: 401 })
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
