import { createAdminClient } from '@/lib/server/admin'

export type LinkPawn = {
  id?: string
  ticket_no: string
  amount: number
  pawn_date?: string
  renewal_principal_paid?: number
}

export type PawnDetailRow = {
  id: string
  ticket_no: string
  pawn_date: string
  amount: number
  status: string
  tx_status: string
  notes: string | null
  pawn_slip_url: string | null
  renewed_from_id: string | null
  renewal_principal_paid: number | null
  renewal_interest: number | null
}

export type InterestRow = {
  id: string
  payment_date: string
  amount: number
  slip_url: string | null
}

export type RedemptionRow = {
  id: string
  redeem_date: string
  interest_total: number
  pawn_slip_url: string | null
  transfer_slip_url: string | null
}

export type TransferSlipRow = {
  id: string
  direction: string
  slip_url: string | null
  amount: number | null
  created_at: string
}

export type PawnDetailData = {
  pawn: PawnDetailRow | null
  renewedFrom: LinkPawn | null
  renewedTo: LinkPawn | null
  interests: InterestRow[]
  redemption: RedemptionRow | null
  transferSlips: TransferSlipRow[]
}

export async function fetchPawnDetail(id: string): Promise<PawnDetailData> {
  const supabase = createAdminClient()

  const { data: pawn, error: pawnError } = await supabase
    .from('pawns')
    .select('id, ticket_no, pawn_date, amount, status, tx_status, notes, pawn_slip_url, renewed_from_id, renewal_principal_paid, renewal_interest')
    .eq('id', id)
    .maybeSingle()

  if (pawnError) throw pawnError
  if (!pawn) {
    return {
      pawn: null,
      renewedFrom: null,
      renewedTo: null,
      interests: [],
      redemption: null,
      transferSlips: [],
    }
  }

  const [
    { data: renewedFrom, error: renewedFromError },
    { data: renewedTo, error: renewedToError },
    { data: interests, error: interestsError },
    { data: redemption, error: redemptionError },
    { data: transferSlips, error: transferSlipsError },
  ] = await Promise.all([
    pawn.renewed_from_id
      ? supabase.from('pawns').select('id, ticket_no, amount, pawn_date').eq('id', pawn.renewed_from_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('pawns').select('id, ticket_no, amount, renewal_principal_paid').eq('renewed_from_id', pawn.id).maybeSingle(),
    supabase.from('interest_payments').select('id, payment_date, amount, slip_url').eq('pawn_id', id).order('payment_date'),
    supabase.from('redemptions').select('id, redeem_date, interest_total, pawn_slip_url, transfer_slip_url').eq('pawn_id', id).maybeSingle(),
    supabase.from('transfer_slips').select('id, direction, slip_url, amount, created_at').eq('pawn_id', id).order('created_at'),
  ])

  const firstError = renewedFromError || renewedToError || interestsError || redemptionError || transferSlipsError
  if (firstError) throw firstError

  return {
    pawn,
    renewedFrom: renewedFrom || null,
    renewedTo: renewedTo || null,
    interests: interests || [],
    redemption: redemption || null,
    transferSlips: transferSlips || [],
  }
}
