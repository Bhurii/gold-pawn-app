import { NextRequest, NextResponse } from 'next/server'
import { upsertPushSubscription } from '@/lib/push-server'
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

  const limiter = hitRateLimit(`push-subscribe:${getClientKey(request)}`, 20, 10 * 60 * 1000)
  if (!limiter.allowed) {
    return NextResponse.json({ error: 'ลองใหม่อีกครั้งในภายหลัง' }, { status: 429 })
  }

  const payload = await request.json()
  if (!payload?.endpoint) {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
  }

  await upsertPushSubscription({
    ...payload,
    role: user.role,
    userId: user.id,
    displayName: user.display_name,
  })
  return NextResponse.json({ ok: true })
}
