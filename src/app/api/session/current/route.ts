import { NextRequest, NextResponse } from 'next/server'
import { readSessionFromRequest } from '@/lib/server/app-session'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  return NextResponse.json({ user })
}
