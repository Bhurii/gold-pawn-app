import { NextRequest, NextResponse } from 'next/server'
import { fetchLoanDetail } from '@/lib/server/loan-detail'
import { canAccessFundOwner } from '@/lib/server/fund-access'
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
    if (!canAccessFundOwner(user, data.loan.fund_owner)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load loan detail' }, { status: 500 })
  }
}
