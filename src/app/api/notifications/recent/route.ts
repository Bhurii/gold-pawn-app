import { NextRequest, NextResponse } from 'next/server'
import { getNotificationFeed, getPendingActionFeed } from '@/lib/push-server'
import { readSessionFromRequest } from '@/lib/server/app-session'
import { getOrSetMemoryCache } from '@/lib/server/memory-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const data = await getOrSetMemoryCache(`api:notifications:recent:${user.user_key}`, 10000, async () => {
    const [feed, pendingActions] = await Promise.all([
      getNotificationFeed(user, 12),
      getPendingActionFeed(user),
    ])

    return { notifications: feed, pendingActions }
  })

  return NextResponse.json(data)
}
