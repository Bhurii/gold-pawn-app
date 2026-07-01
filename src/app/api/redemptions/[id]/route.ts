import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/admin'
import { canAccessFundOwner } from '@/lib/server/fund-access'
import { readSessionFromRequest } from '@/lib/server/app-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RedemptionWithPawnRow = {
  id: string
  pawn_id: string
  redeem_date: string
  interest_total: number
  pawn_slip_url: string | null
  transfer_slip_url: string | null
  pawns: {
    id: string
    ticket_no: string
    amount: number
    fund_owner: string | null
  } | Array<{
    id: string
    ticket_no: string
    amount: number
    fund_owner: string | null
  }> | null
}

function relationFirst<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const supabase = createAdminClient()

  try {
    const { data, error } = await supabase
      .from('redemptions')
      .select('id, pawn_id, redeem_date, interest_total, pawn_slip_url, transfer_slip_url, pawns!inner(id, ticket_no, amount, fund_owner)')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      throw error
    }

    const redemption = data as RedemptionWithPawnRow | null
    const pawn = relationFirst(redemption?.pawns)

    if (!redemption || !pawn) {
      return NextResponse.json({ error: 'Redemption not found' }, { status: 404 })
    }

    if (!canAccessFundOwner(user, pawn.fund_owner)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      redemption: {
        id: redemption.id,
        pawn_id: redemption.pawn_id,
        redeem_date: redemption.redeem_date,
        interest_total: redemption.interest_total,
        pawn_slip_url: redemption.pawn_slip_url,
        transfer_slip_url: redemption.transfer_slip_url,
      },
      pawn: {
        id: pawn.id,
        ticket_no: pawn.ticket_no,
        amount: pawn.amount,
        fund_owner: pawn.fund_owner,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load redemption detail' }, { status: 500 })
  }
}
