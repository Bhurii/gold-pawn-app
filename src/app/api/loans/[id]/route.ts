import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/admin'
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
  const supabase = createAdminClient()

  const { data: loan, error: loanError } = await supabase
    .from('loans')
    .select('id, borrower_name, principal, remaining_principal, interest_rate, notes, status')
    .eq('id', id)
    .maybeSingle()

  if (loanError) {
    return NextResponse.json({ error: loanError.message }, { status: 500 })
  }

  if (!loan) {
    return NextResponse.json({ loan: null }, { status: 404 })
  }

  const { data: txns, error: txnError } = await supabase
    .from('loan_transactions')
    .select('id, type, amount, transaction_date, slip_url, note')
    .eq('loan_id', id)
    .order('transaction_date')

  if (txnError) {
    return NextResponse.json({ error: txnError.message }, { status: 500 })
  }

  return NextResponse.json({
    loan,
    txns: txns || [],
  })
}
