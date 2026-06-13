import { NextRequest, NextResponse } from 'next/server'
import { unsubscribePushSubscription } from '@/lib/push-server'
import { readSessionFromRequest } from '@/lib/server/app-session'

export async function POST(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await request.json()
  if (!payload?.endpoint) {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
  }

  await unsubscribePushSubscription(payload.endpoint)
  return NextResponse.json({ ok: true })
}
