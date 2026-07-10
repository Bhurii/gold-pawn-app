import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/admin'
import { applyFundScopeFilter, resolveFundScope } from '@/lib/server/fund-access'
import { readSessionFromRequest } from '@/lib/server/app-session'
import { getOrSetMemoryCache } from '@/lib/server/memory-cache'
import { getBudgetForScope, loadBudgetState } from '@/lib/server/settings-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function relationFirst<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0]
  return value || null
}

function parseMonth(value: string | null) {
  if (value === 'all') return 'all' as const
  const month = Number(value)
  return Number.isInteger(month) && month >= 0 && month <= 11 ? month : new Date().getMonth()
}

function getMonthRange(year: number, month: number | 'all') {
  if (month === 'all') {
    return {
      firstDay: `${year}-01-01`,
      lastDay: `${year}-12-31`,
    }
  }

  return {
    firstDay: `${year}-${String(month + 1).padStart(2, '0')}-01`,
    lastDay: new Date(year, month + 1, 0).toISOString().split('T')[0],
  }
}

export async function GET(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const year = Number(url.searchParams.get('year'))
  if (!Number.isInteger(year) || year < 2024 || year > 2100) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
  }

  const ownerScope = resolveFundScope(user, url.searchParams.get('owner_scope'))
  const selectedMonth = parseMonth(url.searchParams.get('month'))
  const summaryRange = getMonthRange(year, 'all')
  const detailRange = getMonthRange(year, selectedMonth)

  const data = await getOrSetMemoryCache(`api:report-summary:${ownerScope}:${year}:${selectedMonth}`, 60000, async () => {
    const supabase = createAdminClient()

    let interestsSummaryQuery = supabase
      .from('interest_payments')
      .select('amount, payment_date, pawns!inner(fund_owner)')
      .gte('payment_date', summaryRange.firstDay)
      .lte('payment_date', summaryRange.lastDay)

    let redemptionsSummaryQuery = supabase
      .from('redemptions')
      .select('interest_last, redeem_date, pawns!inner(fund_owner)')
      .gte('redeem_date', summaryRange.firstDay)
      .lte('redeem_date', summaryRange.lastDay)

    let loanTxSummaryQuery = supabase
      .from('loan_transactions')
      .select('amount, transaction_date, loans!inner(fund_owner)')
      .eq('type', 'interest')
      .gte('transaction_date', summaryRange.firstDay)
      .lte('transaction_date', summaryRange.lastDay)

    let interestDetailsQuery = supabase
      .from('interest_payments')
      .select('amount, payment_date, pawns!inner(ticket_no, fund_owner)')
      .gte('payment_date', detailRange.firstDay)
      .lte('payment_date', detailRange.lastDay)

    let redemptionDetailsQuery = supabase
      .from('redemptions')
      .select('interest_last, redeem_date, pawns!inner(ticket_no, fund_owner)')
      .gte('redeem_date', detailRange.firstDay)
      .lte('redeem_date', detailRange.lastDay)

    let loanDetailsQuery = supabase
      .from('loan_transactions')
      .select('amount, transaction_date, loans!inner(borrower_name, fund_owner)')
      .eq('type', 'interest')
      .gte('transaction_date', detailRange.firstDay)
      .lte('transaction_date', detailRange.lastDay)

    let newPawnsQuery = supabase
      .from('pawns')
      .select('amount')
      .is('renewed_from_id', null)
      .gte('pawn_date', detailRange.firstDay)
      .lte('pawn_date', detailRange.lastDay)

    let pawnsQuery = supabase.from('pawns').select('amount').eq('status', 'active').eq('tx_status', 'active')
    let loansQuery = supabase.from('loans').select('remaining_principal').eq('status', 'active')

    if (ownerScope !== 'all') {
      interestsSummaryQuery = interestsSummaryQuery.eq('pawns.fund_owner', ownerScope)
      redemptionsSummaryQuery = redemptionsSummaryQuery.eq('pawns.fund_owner', ownerScope)
      loanTxSummaryQuery = loanTxSummaryQuery.eq('loans.fund_owner', ownerScope)
      interestDetailsQuery = interestDetailsQuery.eq('pawns.fund_owner', ownerScope)
      redemptionDetailsQuery = redemptionDetailsQuery.eq('pawns.fund_owner', ownerScope)
      loanDetailsQuery = loanDetailsQuery.eq('loans.fund_owner', ownerScope)
      newPawnsQuery = newPawnsQuery.eq('fund_owner', ownerScope)
      pawnsQuery = applyFundScopeFilter(pawnsQuery, ownerScope)
      loansQuery = applyFundScopeFilter(loansQuery, ownerScope)
    }

    const [
      { data: interestsSummary },
      { data: redemptionsSummary },
      { data: loanTxSummary },
      { data: interestDetails },
      { data: redemptionDetails },
      { data: loanDetailRows },
      { data: newPawns },
      { data: pawns },
      { data: loans },
      budgets,
    ] = await Promise.all([
      interestsSummaryQuery,
      redemptionsSummaryQuery,
      loanTxSummaryQuery,
      interestDetailsQuery,
      redemptionDetailsQuery,
      loanDetailsQuery,
      newPawnsQuery,
      pawnsQuery,
      loansQuery,
      loadBudgetState(),
    ])

    const monthlyData = Array.from({ length: 12 }, () => 0)
    const pawnDetails: Array<{ ticket?: string; amount: number; date: string; type: string }> = []
    const loanDetails: Array<{ name?: string; amount: number; date: string }> = []

    for (const interest of interestsSummary || []) {
      const month = new Date(`${interest.payment_date}T00:00:00`).getMonth()
      monthlyData[month] += Number(interest.amount || 0)
    }

    for (const redemption of redemptionsSummary || []) {
      const month = new Date(`${redemption.redeem_date}T00:00:00`).getMonth()
      monthlyData[month] += Number(redemption.interest_last || 0)
    }

    for (const txn of loanTxSummary || []) {
      const month = new Date(`${txn.transaction_date}T00:00:00`).getMonth()
      monthlyData[month] += Number(txn.amount || 0)
    }

    for (const interest of interestDetails || []) {
      pawnDetails.push({
        ticket: relationFirst(interest.pawns)?.ticket_no,
        amount: Number(interest.amount || 0),
        date: interest.payment_date,
        type: 'ตัดดอก',
      })
    }

    for (const redemption of redemptionDetails || []) {
      pawnDetails.push({
        ticket: relationFirst(redemption.pawns)?.ticket_no,
        amount: Number(redemption.interest_last || 0),
        date: redemption.redeem_date,
        type: 'ไถ่ถอน',
      })
    }

    for (const txn of loanDetailRows || []) {
      loanDetails.push({
        name: relationFirst(txn.loans)?.borrower_name,
        amount: Number(txn.amount || 0),
        date: txn.transaction_date,
      })
    }

    return {
      budget: getBudgetForScope(budgets, ownerScope),
      activePawnsAmount: (pawns || []).reduce((sum, pawn) => sum + Number(pawn.amount || 0), 0),
      activeLoansAmount: (loans || []).reduce((sum, loan) => sum + Number(loan.remaining_principal || 0), 0),
      newPawnsCount: (newPawns || []).length,
      newPawnsAmount: (newPawns || []).reduce((sum, pawn) => sum + Number(pawn.amount || 0), 0),
      monthlyData,
      pawnDetails: pawnDetails.sort((a, b) => b.date.localeCompare(a.date)),
      loanDetails: loanDetails.sort((a, b) => b.date.localeCompare(a.date)),
    }
  })

  return NextResponse.json(data)
}
