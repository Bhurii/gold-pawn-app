import { createAdminClient } from '@/lib/server/admin'

export type LoanRow = {
  id: string
  borrower_name: string
  fund_owner: string
  principal: number
  remaining_principal: number
  interest_rate: number
  notes: string | null
  status: 'active' | 'closed'
}

export type LoanTxnRow = {
  id: string
  type: string
  amount: number
  transaction_date: string
  slip_url: string | null
  note: string | null
}

export type LoanDetailData = {
  loan: LoanRow | null
  txns: LoanTxnRow[]
}

export async function fetchLoanDetail(id: string): Promise<LoanDetailData> {
  const supabase = createAdminClient()

  const { data: loan, error: loanError } = await supabase
    .from('loans')
    .select('id, borrower_name, fund_owner, principal, remaining_principal, interest_rate, notes, status')
    .eq('id', id)
    .maybeSingle()

  if (loanError) throw loanError
  if (!loan) {
    return { loan: null, txns: [] }
  }

  const { data: txns, error: txnError } = await supabase
    .from('loan_transactions')
    .select('id, type, amount, transaction_date, slip_url, note')
    .eq('loan_id', id)
    .order('transaction_date')

  if (txnError) throw txnError

  return {
    loan,
    txns: txns || [],
  }
}
