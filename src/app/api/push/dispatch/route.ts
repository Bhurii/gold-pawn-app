import { NextRequest, NextResponse } from 'next/server'
import { createPushTestNotification, dispatchPushSignals } from '@/lib/push-server'
import { readSessionFromRequest } from '@/lib/server/app-session'
import { hitRateLimit } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getClientKey(request: NextRequest) {
  return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'local'
}

export async function POST(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limiter = hitRateLimit(`push-dispatch:${getClientKey(request)}`, 20, 10 * 60 * 1000)
  if (!limiter.allowed) {
    return NextResponse.json({ error: 'ลองใหม่อีกครั้งในภายหลัง' }, { status: 429 })
  }

  let kind = ''
  try {
    const body = await request.json()
    kind = body?.kind || ''
  } catch {
    kind = ''
  }

  if (kind === 'test') {
    await createPushTestNotification(user.display_name)
  }

  const result = await dispatchPushSignals()
  if (result.disabled) {
    return NextResponse.json({ ok: false, ...result }, { status: 503 })
  }
  return NextResponse.json({ ok: true, ...result })
}
