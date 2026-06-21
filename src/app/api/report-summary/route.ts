import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/admin'
import { applyFundScopeFilter, resolveFundScope } from '@/lib/server/fund-access'
import { readSessionFromRequest } from '@/lib/server/app-session'
import { getOrSetMemoryCache } from '@/lib/server/memory-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function relationFirst<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0]
  return value || null
}

export async function GET(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const year = Number(new URL(request.url).searchParams.get('year'))
  if (!Number.isInteger(year) || year < 2024 || year > 2100) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
  }

  const firstDay = `${year}-01-01`
  const lastDay = `${year}-12-31`
  const ownerScope = resolveFundScope(user, new URL(request.url).searchParams.get('owner_scope'))

  const data = await getOrSetMemoryCache(`api:report-summary:${ownerScope}:${year}`, 60000, async () => {
    const supabase = createAdminClient()
    let interestsQuery = supabase.from('interest_payments').select('amount, payment_date, pawns!inner(ticket_no, fund_owner)').gte('payment_date', firstDay).lte('payment_date', lastDay)
    let redemptionsQuery = supabase.from('redemptions').select('interest_last, redeem_date, pawns!inner(ticket_no, fund_owner)').gte('redeem_date', firstDay).lte('redeem_date', lastDay)
    let loanTxQuery = supabase.from('loan_transactions').select('amount, transaction_date, loans!inner(borrower_name, fund_owner)').eq('type', 'interest').gte('transaction_date', firstDay).lte('transaction_date', lastDay)
    let pawnsQuery = supabase.from('pawns').select('amount').eq('status', 'active').eq('tx_status', 'active')
    let loansQuery = supabase.from('loans').select('remaining_principal').eq('status', 'active')

    if (ownerScope !== 'all') {
      interestsQuery = interestsQuery.eq('pawns.fund_owner', ownerScope)
      redemptionsQuery = redemptionsQuery.eq('pawns.fund_owner', ownerScope)
      loanTxQuery = loanTxQuery.eq('loans.fund_owner', ownerScope)
      pawnsQuery = applyFundScopeFilter(pawnsQuery, ownerScope)
      loansQuery = applyFundScopeFilter(loansQuery, ownerScope)
    }

    const [
      { data: settings },
      { data: interests },
      { data: redemptions },
      { data: loanTxns },
      { data: pawns },
      { data: loans },
    ] = await Promise.all([
      supabase.from('settings').select('invest_budget').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      interestsQuery,
      redemptionsQuery,
      loanTxQuery,
      pawnsQuery,
      loansQuery,
    ])

    const monthlyData = Array.from({ length: 12 }, () => 0)
    const pawnDetails: Array<{ ticket?: string; amount: number; date: string; type: string }> = []
    const loanDetails: Array<{ name?: string; amount: number; date: string }> = []

    for (const interest of interests || []) {
      const month = new Date(`${interest.payment_date}T00:00:00`).getMonth()
      const amount = Number(interest.amount || 0)
      monthlyData[month] += amount
      pawnDetails.push({
        ticket: relationFirst(interest.pawns)?.ticket_no,
        amount,
        date: interest.payment_date,
        type: 'ตัดดอก',
      })
    }

    for (const redemption of redemptions || []) {
      const month = new Date(`${redemption.redeem_date}T00:00:00`).getMonth()
      const amount = Number(redemption.interest_last || 0)
      monthlyData[month] += amount
      pawnDetails.push({
        ticket: relationFirst(redemption.pawns)?.ticket_no,
        amount,
        date: redemption.redeem_date,
        type: 'ไถ่ถอน',
      })
    }

    for (const txn of loanTxns || []) {
      const month = new Date(`${txn.transaction_date}T00:00:00`).getMonth()
      const amount = Number(txn.amount || 0)
      monthlyData[month] += amount
      loanDetails.push({
        name: relationFirst(txn.loans)?.borrower_name,
        amount,
        date: txn.transaction_date,
      })
    }

    return {
      budget: Number(settings?.invest_budget || 0),
      activePawnsAmount: (pawns || []).reduce((sum, pawn) => sum + Number(pawn.amount || 0), 0),
      activeLoansAmount: (loans || []).reduce((sum, loan) => sum + Number(loan.remaining_principal || 0), 0),
      monthlyData,
      pawnDetails: pawnDetails.sort((a, b) => b.date.localeCompare(a.date)),
      loanDetails: loanDetails.sort((a, b) => b.date.localeCompare(a.date)),
    }
  })

  return NextResponse.json(data)
}
