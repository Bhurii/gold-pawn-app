import { NextRequest, NextResponse } from 'next/server'
import { getNotificationFeed } from '@/lib/push-server'
import { readSessionFromRequest } from '@/lib/server/app-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const feed = await getNotificationFeed(user.role, 12)
  return NextResponse.json({ notifications: feed })
}
