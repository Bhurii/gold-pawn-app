import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/admin'
import { readSessionFromRequest } from '@/lib/server/app-session'
import { createNotificationAction } from '@/lib/notification-meta'
import { insertNotificationRecord } from '@/lib/notification-store'
import { getNotificationRecipientsForFundOwner, isFundOwnerKey, type FundOwnerKey } from '@/lib/fund-owner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

function ensureString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(field)
  }
  return value.trim()
}

function ensureNumber(value: unknown, field: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(field)
  }
  return parsed
}

function ownerFromValue(value: unknown, fallback: FundOwnerKey = 'tony') {
  return typeof value === 'string' && isFundOwnerKey(value) ? value : fallback
}

async function insertNotification(
  supabase: ReturnType<typeof createAdminClient>,
  type: string,
  message: string,
  pawnId: string,
  owner: FundOwnerKey,
  actionPath: string,
) {
  const { error } = await insertNotificationRecord(supabase, {
    type,
    message,
    pawn_id: pawnId,
    action_url: createNotificationAction(actionPath, [...getNotificationRecipientsForFundOwner(owner)]),
  })
  if (error) throw error
}

export async function POST(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) return unauthorized()

  const body = await request.json().catch(() => null)
  const action = typeof body?.action === 'string' ? body.action : ''
  const supabase = createAdminClient()

  try {
    if (action === 'create_pawn') {
      const ticketNo = ensureString(body.ticket_no, 'Missing ticket_no')
      const pawnDate = ensureString(body.pawn_date, 'Missing pawn_date')
      const amount = ensureNumber(body.amount, 'Invalid amount')
      const fundOwner = ownerFromValue(body.fund_owner, user.user_key)
      const pawnSlipUrl = typeof body.pawn_slip_url === 'string' ? body.pawn_slip_url : ''

      const { data: pawn, error } = await supabase.from('pawns').insert({
        ticket_no: ticketNo,
        pawn_date: pawnDate,
        amount,
        fund_owner: fundOwner,
        pawn_slip_url: pawnSlipUrl,
        status: 'active',
        tx_status: 'pending_transfer',
      }).select('id').single()
      if (error) throw error

      await insertNotification(
        supabase,
        'pawn_created',
        `มีรายการรับจำนำใหม่ ตั๋ว #${ticketNo} ฿${amount.toLocaleString('th-TH')} ของ${fundOwner} รอโอนเงิน`,
        pawn.id,
        fundOwner,
        `/pawns/${pawn.id}`,
      )

      return NextResponse.json({ ok: true, pawnId: pawn.id })
    }

    if (action === 'renew') {
      const pawnId = ensureString(body.pawn_id, 'Missing pawn_id')
      const oldTicketNo = ensureString(body.old_ticket_no, 'Missing old_ticket_no')
      const newTicketNo = ensureString(body.new_ticket_no, 'Missing new_ticket_no')
      const newDate = ensureString(body.new_date, 'Missing new_date')
      const newAmount = ensureNumber(body.new_amount, 'Invalid new_amount')
      const interest = ensureNumber(body.interest, 'Invalid interest')
      const principalPaid = ensureNumber(body.principal_paid, 'Invalid principal_paid')
      const fundOwner = ownerFromValue(body.fund_owner, 'tony')
      const previousNotes = typeof body.previous_notes === 'string' ? body.previous_notes : ''
      const newTicketUrl = typeof body.new_ticket_url === 'string' ? body.new_ticket_url : ''
      const transferUrl = typeof body.transfer_url === 'string' ? body.transfer_url : ''

      const { data: newPawn, error } = await supabase.from('pawns').insert({
        ticket_no: newTicketNo,
        pawn_date: newDate,
        amount: newAmount,
        fund_owner: fundOwner,
        pawn_slip_url: newTicketUrl,
        status: 'active',
        tx_status: 'active',
        renewed_from_id: pawnId,
        renewal_interest: interest,
        renewal_principal_paid: principalPaid,
        notes: `ต่อจากตั๋ว #${oldTicketNo}`,
      }).select('id').single()
      if (error) throw error

      const { error: previousPawnError } = await supabase.from('pawns').update({
        status: 'redeemed',
        tx_status: 'redeemed',
        notes: previousNotes
          ? `${previousNotes} | ลดต้น -> ตั๋วใหม่ #${newTicketNo}`
          : `ลดต้น -> ตั๋วใหม่ #${newTicketNo}`,
      }).eq('id', pawnId)
      if (previousPawnError) throw previousPawnError

      const { error: redemptionError } = await supabase.from('redemptions').insert({
        pawn_id: pawnId,
        redeem_date: newDate,
        interest_last: interest,
        interest_total: interest,
        total_return: ensureNumber(body.old_amount, 'Invalid old_amount') + interest,
        pawn_slip_url: newTicketUrl,
        transfer_slip_url: transferUrl,
        status: 'confirmed',
      })
      if (redemptionError) throw redemptionError

      if (transferUrl) {
        const { error: transferError } = await supabase.from('transfer_slips').insert({
          pawn_id: newPawn.id,
          direction: 'me_to_mom',
          slip_url: transferUrl,
          amount: interest + principalPaid,
          confirmed_at: new Date().toISOString(),
        })
        if (transferError) throw transferError
      }

      await insertNotification(
        supabase,
        'renewed',
        `ลดต้นตั๋ว #${oldTicketNo} -> ตั๋วใหม่ #${newTicketNo} ยอด ฿${newAmount.toLocaleString('th-TH')}`,
        newPawn.id,
        fundOwner,
        `/pawns/${newPawn.id}`,
      )

      return NextResponse.json({ ok: true, pawnId: newPawn.id })
    }

    if (action === 'topup') {
      const pawnId = ensureString(body.pawn_id, 'Missing pawn_id')
      const oldTicketNo = ensureString(body.old_ticket_no, 'Missing old_ticket_no')
      const newTicketNo = ensureString(body.new_ticket_no, 'Missing new_ticket_no')
      const newDate = ensureString(body.new_date, 'Missing new_date')
      const newAmount = ensureNumber(body.new_amount, 'Invalid new_amount')
      const interest = ensureNumber(body.interest, 'Invalid interest')
      const topupAmount = ensureNumber(body.topup_amount, 'Invalid topup_amount')
      const fundOwner = ownerFromValue(body.fund_owner, 'tony')
      const previousNotes = typeof body.previous_notes === 'string' ? body.previous_notes : ''
      const newTicketUrl = typeof body.new_ticket_url === 'string' ? body.new_ticket_url : ''
      const transferUrl = typeof body.transfer_url === 'string' ? body.transfer_url : ''

      const { data: newPawn, error } = await supabase.from('pawns').insert({
        ticket_no: newTicketNo,
        pawn_date: newDate,
        amount: newAmount,
        fund_owner: fundOwner,
        pawn_slip_url: newTicketUrl,
        status: 'active',
        tx_status: 'pending_transfer',
        renewed_from_id: pawnId,
        renewal_interest: interest,
        renewal_principal_paid: -topupAmount,
        notes: `ต่อจากตั๋ว #${oldTicketNo}`,
      }).select('id').single()
      if (error) throw error

      const { error: previousPawnError } = await supabase.from('pawns').update({
        status: 'redeemed',
        tx_status: 'redeemed',
        notes: previousNotes
          ? `${previousNotes} | เพิ่มยอด -> ตั๋วใหม่ #${newTicketNo}`
          : `เพิ่มยอด -> ตั๋วใหม่ #${newTicketNo}`,
      }).eq('id', pawnId)
      if (previousPawnError) throw previousPawnError

      const { error: redemptionError } = await supabase.from('redemptions').insert({
        pawn_id: pawnId,
        redeem_date: newDate,
        interest_last: interest,
        interest_total: interest,
        total_return: ensureNumber(body.old_amount, 'Invalid old_amount') + interest,
        pawn_slip_url: newTicketUrl,
        transfer_slip_url: transferUrl,
        status: 'confirmed',
      })
      if (redemptionError) throw redemptionError

      if (transferUrl) {
        const { error: transferError } = await supabase.from('transfer_slips').insert({
          pawn_id: newPawn.id,
          direction: 'mom_to_me',
          slip_url: transferUrl,
          amount: topupAmount,
          confirmed_at: new Date().toISOString(),
        })
        if (transferError) throw transferError
      }

      await insertNotification(
        supabase,
        'topup',
        `เพิ่มยอดตั๋ว #${oldTicketNo} -> ตั๋วใหม่ #${newTicketNo} ยอด ฿${newAmount.toLocaleString('th-TH')} รอโอนเงิน ฿${topupAmount.toLocaleString('th-TH')}`,
        newPawn.id,
        fundOwner,
        `/pawns/${newPawn.id}`,
      )

      return NextResponse.json({ ok: true, pawnId: newPawn.id })
    }

    if (action === 'redeem') {
      const pawnId = ensureString(body.pawn_id, 'Missing pawn_id')
      const ticketNo = ensureString(body.ticket_no, 'Missing ticket_no')
      const fundOwner = ownerFromValue(body.fund_owner, 'tony')
      const redeemDate = ensureString(body.redeem_date, 'Missing redeem_date')
      const interestLast = ensureNumber(body.interest_last, 'Invalid interest_last')
      const interestTotal = ensureNumber(body.interest_total, 'Invalid interest_total')
      const totalReturn = ensureNumber(body.total_return, 'Invalid total_return')
      const pawnSlipUrl = typeof body.pawn_slip_url === 'string' ? body.pawn_slip_url : ''
      const transferSlipUrl = typeof body.transfer_slip_url === 'string' ? body.transfer_slip_url : ''

      const { data: redemption, error } = await supabase.from('redemptions').insert({
        pawn_id: pawnId,
        redeem_date: redeemDate,
        interest_last: interestLast,
        interest_total: interestTotal,
        total_return: totalReturn,
        pawn_slip_url: pawnSlipUrl,
        transfer_slip_url: transferSlipUrl,
        status: 'pending_confirm',
      }).select('id').single()
      if (error) throw error

      const { error: pawnError } = await supabase.from('pawns').update({ tx_status: 'pending_redeem' }).eq('id', pawnId)
      if (pawnError) throw pawnError

      await insertNotification(
        supabase,
        'redeem_pending',
        `มีรายการไถ่ถอน ตั๋ว #${ticketNo} ดอก ฿${interestTotal.toLocaleString('th-TH')} รอยืนยัน`,
        pawnId,
        fundOwner,
        `/redeem/confirm/${redemption.id}`,
      )

      return NextResponse.json({ ok: true, redemptionId: redemption.id })
    }

    if (action === 'confirm_redeem') {
      if (user.role !== 'owner' && user.role !== 'agent') return unauthorized()
      const redemptionId = ensureString(body.redemption_id, 'Missing redemption_id')
      const pawnId = ensureString(body.pawn_id, 'Missing pawn_id')
      const ticketNo = ensureString(body.ticket_no, 'Missing ticket_no')
      const fundOwner = ownerFromValue(body.fund_owner, 'tony')

      const { error: redemptionError } = await supabase.from('redemptions').update({ status: 'confirmed' }).eq('id', redemptionId)
      if (redemptionError) throw redemptionError

      const { error: pawnError } = await supabase.from('pawns').update({ status: 'redeemed', tx_status: 'redeemed' }).eq('id', pawnId)
      if (pawnError) throw pawnError

      await insertNotification(
        supabase,
        'redeemed',
        `ยืนยันไถ่ถอนตั๋ว #${ticketNo} แล้ว`,
        pawnId,
        fundOwner,
        `/pawns/${pawnId}`,
      )

      return NextResponse.json({ ok: true })
    }

    if (action === 'upload_pawn_slip') {
      const pawnId = ensureString(body.pawn_id, 'Missing pawn_id')
      const slipUrl = ensureString(body.slip_url, 'Missing slip_url')
      const { error } = await supabase.from('pawns').update({ pawn_slip_url: slipUrl }).eq('id', pawnId)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (action === 'upload_interest_slip') {
      const interestId = ensureString(body.interest_id, 'Missing interest_id')
      const slipUrl = ensureString(body.slip_url, 'Missing slip_url')
      const { error } = await supabase.from('interest_payments').update({ slip_url: slipUrl }).eq('id', interestId)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (action === 'upload_redemption_slip') {
      const redemptionId = ensureString(body.redemption_id, 'Missing redemption_id')
      const column = body.column === 'pawn_slip_url' || body.column === 'transfer_slip_url' ? body.column : null
      const slipUrl = ensureString(body.slip_url, 'Missing slip_url')
      if (!column) return badRequest('Invalid column')
      const { error } = await supabase.from('redemptions').update({ [column]: slipUrl }).eq('id', redemptionId)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (action === 'confirm_transfer' || action === 'bypass_cash' || action === 'bypass_prepaid') {
      if (user.role !== 'owner' && user.role !== 'agent') return unauthorized()
      const pawnId = ensureString(body.pawn_id, 'Missing pawn_id')
      const ticketNo = ensureString(body.ticket_no, 'Missing ticket_no')
      const fundOwner = ownerFromValue(body.fund_owner, 'tony')

      if (action === 'confirm_transfer') {
        const direction = body.direction === 'mom_to_me' ? 'mom_to_me' : 'me_to_mom'
        const slipUrl = ensureString(body.slip_url, 'Missing slip_url')
        const amount = ensureNumber(body.amount, 'Invalid amount')
        const { error: transferError } = await supabase.from('transfer_slips').insert({
          pawn_id: pawnId,
          direction,
          slip_url: slipUrl,
          amount,
          confirmed_at: new Date().toISOString(),
        })
        if (transferError) throw transferError
      }

      const { error: pawnError } = await supabase.from('pawns').update({ tx_status: 'active' }).eq('id', pawnId)
      if (pawnError) throw pawnError

      const message = action === 'confirm_transfer'
        ? `อัปสลิปโอนเงินแล้ว ตั๋ว #${ticketNo}`
        : action === 'bypass_cash'
          ? `เคลียร์เงินสดแล้ว ตั๋ว #${ticketNo}`
          : `ฝากเงินล่วงหน้าแล้ว ตั๋ว #${ticketNo}`

      await insertNotification(
        supabase,
        action === 'confirm_transfer' ? 'transfer_confirmed' : action,
        message,
        pawnId,
        fundOwner,
        `/pawns/${pawnId}`,
      )

      return NextResponse.json({ ok: true })
    }

    return badRequest('Unsupported action')
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Request failed' }, { status: 500 })
  }
}
