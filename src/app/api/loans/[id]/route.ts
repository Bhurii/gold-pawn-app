import { NextRequest, NextResponse } from 'next/server'
import { fetchLoanDetail } from '@/lib/server/loan-detail'
import { readSessionFromRequest } from '@/lib/server/app-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  try {
    const data = await fetchLoanDetail(id)
    if (!data.loan) {
      return NextResponse.json({ loan: null }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load loan detail' }, { status: 500 })
  }
}
