import { NextRequest, NextResponse } from 'next/server'
import { createNotificationAction } from '@/lib/notification-meta'
import { insertNotificationRecord } from '@/lib/notification-store'
import { getNotificationRecipientsForFundOwner } from '@/lib/fund-owner'
import { createAdminClient } from '@/lib/server/admin'
import { readSessionFromRequest } from '@/lib/server/app-session'
import { canAccessFundOwner } from '@/lib/server/fund-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asOptionalString(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function asPositiveNumber(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function asDateString(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

export async function POST(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const loanId = asString(body?.loan_id)
  const type = asString(body?.type)
  const transactionDate = asDateString(body?.transaction_date)
  const note = asOptionalString(body?.note)
  const slipUrl = asOptionalString(body?.slip_url)

  if (!loanId || !transactionDate || !['interest', 'principal_payment', 'close'].includes(type)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: loan, error: loanError } = await supabase
    .from('loans')
    .select('id, borrower_name, fund_owner, remaining_principal, status')
    .eq('id', loanId)
    .maybeSingle()

  if (loanError) {
    return NextResponse.json({ error: loanError.message }, { status: 500 })
  }

  if (!loan || !canAccessFundOwner(user, loan.fund_owner)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (loan.status !== 'active') {
    return NextResponse.json({ error: 'สินเชื่อนี้ปิดแล้ว' }, { status: 400 })
  }

  const amount = type === 'close' ? Number(loan.remaining_principal || 0) : asPositiveNumber(body?.amount)
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'จำนวนเงินไม่ถูกต้อง' }, { status: 400 })
  }

  if (type === 'principal_payment' && amount > Number(loan.remaining_principal || 0)) {
    return NextResponse.json({ error: 'จำนวนตัดต้นมากกว่ายอดคงเหลือ' }, { status: 400 })
  }

  const { data: txn, error: txnError } = await supabase
    .from('loan_transactions')
    .insert({
      loan_id: loanId,
      type,
      amount,
      transaction_date: transactionDate,
      slip_url: slipUrl,
      note,
    })
    .select('id, loan_id, type, transaction_date, amount, slip_url, note')
    .single()

  if (txnError) {
    return NextResponse.json({ error: txnError.message }, { status: 500 })
  }

  if (type === 'principal_payment') {
    const { error: updateError } = await supabase
      .from('loans')
      .update({ remaining_principal: Math.max(0, Number(loan.remaining_principal || 0) - amount) })
      .eq('id', loanId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
  } else if (type === 'close') {
    const { error: updateError } = await supabase
      .from('loans')
      .update({ remaining_principal: 0, status: 'closed' })
      .eq('id', loanId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
  }

  const notificationType =
    type === 'interest'
      ? 'loan_interest_paid'
      : type === 'principal_payment'
        ? 'loan_principal_paid'
        : 'loan_closed'

  const notificationMessage =
    type === 'interest'
      ? `รับดอกสินเชื่อ ${loan.borrower_name} ฿${amount.toLocaleString('th-TH')}`
      : type === 'principal_payment'
        ? `ตัดต้นสินเชื่อ ${loan.borrower_name} ฿${amount.toLocaleString('th-TH')}`
        : `ปิดสินเชื่อ ${loan.borrower_name} เรียบร้อย`

  const { error: notificationError } = await insertNotificationRecord(supabase, {
    type: notificationType,
    message: notificationMessage,
    action_url: createNotificationAction(
      `/loans/${loanId}`,
      [...getNotificationRecipientsForFundOwner((loan.fund_owner || 'tony') as 'tony' | 'louise' | 'phat')],
    ),
  })

  if (notificationError) {
    return NextResponse.json({ error: notificationError.message }, { status: 500 })
  }

  return NextResponse.json({ transaction: txn })
}

export async function PATCH(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const transactionId = asString(body?.transaction_id)
  const slipUrl = asOptionalString(body?.slip_url)

  if (!transactionId || !slipUrl) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: txn, error: txnError } = await supabase
    .from('loan_transactions')
    .select('id, loan_id, loans!inner(id, fund_owner)')
    .eq('id', transactionId)
    .maybeSingle()

  if (txnError) {
    return NextResponse.json({ error: txnError.message }, { status: 500 })
  }

  const fundOwner = txn?.loans && typeof txn.loans === 'object' && 'fund_owner' in txn.loans ? String(txn.loans.fund_owner || '') : ''
  if (!txn || !canAccessFundOwner(user, fundOwner)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error: updateError } = await supabase.from('loan_transactions').update({ slip_url: slipUrl }).eq('id', transactionId)
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
