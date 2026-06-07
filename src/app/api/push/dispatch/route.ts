import { NextRequest, NextResponse } from 'next/server'
import { createPushTestNotification, dispatchPushSignals } from '@/lib/push-server'

export async function POST(request: NextRequest) {
  let kind = ''
  try {
    const body = await request.json()
    kind = body?.kind || ''
  } catch {
    kind = ''
  }

  if (kind === 'test') {
    await createPushTestNotification()
  }

  const result = await dispatchPushSignals()
  if (result.disabled) {
    return NextResponse.json({ ok: false, ...result }, { status: 503 })
  }
  return NextResponse.json({ ok: true, ...result })
}
