import { NextRequest, NextResponse } from 'next/server'
import { getLatestPushPayloadForUser } from '@/lib/push-server'
import { readSessionFromRequest } from '@/lib/server/app-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint')
  const payload = await getLatestPushPayloadForUser(readSessionFromRequest(request), endpoint)
  return NextResponse.json(payload)
}
