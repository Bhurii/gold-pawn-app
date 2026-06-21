import { NextRequest, NextResponse } from 'next/server'
import { createNotificationAction } from '@/lib/notification-meta'
import { getNotificationRecipientsForFundOwner } from '@/lib/fund-owner'
import { createAdminClient } from '@/lib/server/admin'
import { readSessionFromRequest } from '@/lib/server/app-session'
import { canAccessFundOwner } from '@/lib/server/fund-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pawnId = (new URL(request.url).searchParams.get('pawn_id') || '').trim()
  const supabase = createAdminClient()

  let query = supabase
    .from('interest_payments')
    .select('id, pawn_id, payment_date, amount, slip_url, note')
    .order('payment_date')

  if (pawnId) {
    query = query.eq('pawn_id', pawnId)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ payments: data || [] })
}

export async function POST(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const pawnId = typeof body?.pawn_id === 'string' ? body.pawn_id.trim() : ''
  const paymentDate = typeof body?.payment_date === 'string' ? body.payment_date.trim() : ''
  const note = typeof body?.note === 'string' ? body.note.trim() : ''
  const slipUrl = typeof body?.slip_url === 'string' ? body.slip_url.trim() : ''
  const amount = Number(body?.amount || 0)

  if (!pawnId || !paymentDate || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'ข้อมูลตัดดอกไม่ครบ' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: pawn, error: pawnError } = await supabase
    .from('pawns')
    .select('id, ticket_no, fund_owner')
    .eq('id', pawnId)
    .maybeSingle()

  if (pawnError) {
    return NextResponse.json({ error: pawnError.message }, { status: 500 })
  }

  if (!pawn || !canAccessFundOwner(user, pawn.fund_owner)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: payment, error: paymentError } = await supabase
    .from('interest_payments')
    .insert({
      pawn_id: pawnId,
      payment_date: paymentDate,
      amount,
      slip_url: slipUrl || null,
      note: note || null,
    })
    .select('id, pawn_id, payment_date, amount, slip_url, note')
    .single()

  if (paymentError) {
    return NextResponse.json({ error: paymentError.message }, { status: 500 })
  }

  const { error: notificationError } = await supabase.from('notifications').insert({
    type: 'interest_paid',
    message: `ตัดดอกตั๋ว #${pawn.ticket_no} ฿${amount.toLocaleString('th-TH')}`,
    pawn_id: pawnId,
    action_url: createNotificationAction(`/pawns/${pawnId}`, [...getNotificationRecipientsForFundOwner((pawn.fund_owner || 'tony') as 'tony' | 'louise' | 'phat')]),
  })

  if (notificationError) {
    return NextResponse.json({ error: notificationError.message }, { status: 500 })
  }

  return NextResponse.json({ payment })
}
