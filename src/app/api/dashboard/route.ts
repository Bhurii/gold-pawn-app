import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/admin'
import { applyFundScopeFilter, resolveFundScope } from '@/lib/server/fund-access'
import { readSessionFromRequest } from '@/lib/server/app-session'
import { getOrSetMemoryCache } from '@/lib/server/memory-cache'
import { getBudgetForScope, loadBudgetState } from '@/lib/server/settings-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const ownerScope = resolveFundScope(user, new URL(request.url).searchParams.get('owner_scope'))
  const data = await getOrSetMemoryCache(`api:dashboard:${ownerScope}:${firstDay}`, 15000, async () => {
    const supabase = createAdminClient()
    let pawnsQuery = supabase.from('pawns').select('id, ticket_no, fund_owner, amount, tx_status').eq('status', 'active')
    let pendingRedeemQuery = supabase.from('redemptions').select('id, pawn_id, status, pawns(ticket_no, amount, fund_owner)').eq('status', 'pending_confirm')
    let loansQuery = supabase.from('loans').select('id, remaining_principal').eq('status', 'active')
    let interestsQuery = supabase.from('interest_payments').select('amount, pawns!inner(fund_owner)').gte('payment_date', firstDay)
    let redemptionsQuery = supabase.from('redemptions').select('interest_last, pawns!inner(fund_owner)').gte('redeem_date', firstDay)
    let loanTxQuery = supabase.from('loan_transactions').select('amount, loans!inner(fund_owner)').eq('type', 'interest').gte('transaction_date', firstDay)

    pawnsQuery = applyFundScopeFilter(pawnsQuery, ownerScope)
    pendingRedeemQuery = ownerScope === 'all' ? pendingRedeemQuery : pendingRedeemQuery.eq('pawns.fund_owner', ownerScope)
    loansQuery = applyFundScopeFilter(loansQuery, ownerScope)
    interestsQuery = ownerScope === 'all' ? interestsQuery : interestsQuery.eq('pawns.fund_owner', ownerScope)
    redemptionsQuery = ownerScope === 'all' ? redemptionsQuery : redemptionsQuery.eq('pawns.fund_owner', ownerScope)
    loanTxQuery = ownerScope === 'all' ? loanTxQuery : loanTxQuery.eq('loans.fund_owner', ownerScope)

    const [
      { data: pawns },
      { data: pendingR },
      { data: loans },
      { data: interests },
      { data: redemptions },
      { data: loanTxns },
      budgets,
    ] = await Promise.all([
      pawnsQuery,
      pendingRedeemQuery,
      loansQuery,
      interestsQuery,
      redemptionsQuery,
      loanTxQuery,
      loadBudgetState(),
    ])

    const activeReadyPawns = (pawns || []).filter((pawn) => pawn.tx_status === 'active')
    const monthInterest =
      (interests || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
      + (redemptions || []).reduce((sum, item) => sum + Number(item.interest_last || 0), 0)
      + (loanTxns || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)

    return {
      budget: getBudgetForScope(budgets, ownerScope),
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
    }
  })

  return NextResponse.json({ ...data, user })
}
