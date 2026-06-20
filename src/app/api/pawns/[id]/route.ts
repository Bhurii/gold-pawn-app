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

  const { data: pawn, error: pawnError } = await supabase
    .from('pawns')
    .select('id, ticket_no, pawn_date, amount, status, tx_status, notes, pawn_slip_url, renewed_from_id, renewal_principal_paid, renewal_interest')
    .eq('id', id)
    .maybeSingle()

  if (pawnError) {
    return NextResponse.json({ error: pawnError.message }, { status: 500 })
  }

  if (!pawn) {
    return NextResponse.json({ pawn: null }, { status: 404 })
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
  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 })
  }

  return NextResponse.json({
    pawn,
    renewedFrom: renewedFrom || null,
    renewedTo: renewedTo || null,
    interests: interests || [],
    redemption: redemption || null,
    transferSlips: transferSlips || [],
  })
}
