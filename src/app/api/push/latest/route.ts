import { NextResponse } from 'next/server'
import { getLatestPushPayload } from '@/lib/push-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint')
  const payload = await getLatestPushPayload(endpoint)
  return NextResponse.json(payload)
}
