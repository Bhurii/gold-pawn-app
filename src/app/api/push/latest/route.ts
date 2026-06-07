import { NextResponse } from 'next/server'
import { getLatestPushPayload } from '@/lib/push-server'

export async function GET() {
  const payload = await getLatestPushPayload()
  return NextResponse.json(payload)
}
