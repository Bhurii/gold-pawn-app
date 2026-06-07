import { NextRequest, NextResponse } from 'next/server'
import { unsubscribePushSubscription } from '@/lib/push-server'

export async function POST(request: NextRequest) {
  const payload = await request.json()
  if (!payload?.endpoint) {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
  }

  await unsubscribePushSubscription(payload.endpoint)
  return NextResponse.json({ ok: true })
}
