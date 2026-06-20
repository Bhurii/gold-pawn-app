import { NextRequest, NextResponse } from 'next/server'
import { getNotificationFeed, getPendingActionFeed } from '@/lib/push-server'
import { readSessionFromRequest } from '@/lib/server/app-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [feed, pendingActions] = await Promise.all([
    getNotificationFeed(user.role, 12),
    getPendingActionFeed(user.role),
  ])

  return NextResponse.json({ notifications: feed, pendingActions })
}
