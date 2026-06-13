import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/admin'
import { readSessionFromRequest } from '@/lib/server/app-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const [
    { data: settings },
    { data: pawns },
    { data: pendingR },
    { data: loans },
    { data: interests },
    { data: redemptions },
    { data: loanTxns },
  ] = await Promise.all([
    supabase.from('settings').select('invest_budget').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('pawns').select('id, ticket_no, amount, tx_status').eq('status', 'active'),
    supabase.from('redemptions').select('id, pawn_id, status, pawns(ticket_no, amount)').eq('status', 'pending_confirm'),
    supabase.from('loans').select('id, remaining_principal').eq('status', 'active'),
    supabase.from('interest_payments').select('amount').gte('payment_date', firstDay),
    supabase.from('redemptions').select('interest_last').gte('redeem_date', firstDay),
    supabase.from('loan_transactions').select('amount').eq('type', 'interest').gte('transaction_date', firstDay),
  ])

  const activeReadyPawns = (pawns || []).filter((pawn) => pawn.tx_status === 'active')
  const monthInterest =
    (interests || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
    + (redemptions || []).reduce((sum, item) => sum + Number(item.interest_last || 0), 0)
    + (loanTxns || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)

  return NextResponse.json({
    budget: Number(settings?.invest_budget || 0),
    activePawns: activeReadyPawns.length,
    activeAmount: activeReadyPawns.reduce((sum, pawn) => sum + Number(pawn.amount || 0), 0),
    activeLoans: (loans || []).length,
    loanAmount: (loans || []).reduce((sum, loan) => sum + Number(loan.remaining_principal || 0), 0),
    monthInterest,
    pendingPawns: (pawns || []).filter((pawn) => pawn.tx_status === 'pending_transfer'),
    pendingRedeems: (pendingR || []).map((redeem) => ({
      ...redeem,
      pawns: Array.isArray(redeem.pawns) ? redeem.pawns[0] ?? null : redeem.pawns,
    })),
    user,
  })
}
