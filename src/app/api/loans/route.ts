import { NextRequest, NextResponse } from 'next/server'
import { createNotificationAction } from '@/lib/notification-meta'
import { insertNotificationRecord } from '@/lib/notification-store'
import { getNotificationRecipientsForFundOwner, isFundOwnerKey } from '@/lib/fund-owner'
import { createAdminClient } from '@/lib/server/admin'
import { applyFundScopeFilter, canAccessFundOwner, resolveFundScope } from '@/lib/server/fund-access'
import { readSessionFromRequest } from '@/lib/server/app-session'
import { getOrSetMemoryCache } from '@/lib/server/memory-cache'

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

function asNonNegativeNumber(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

function asPositiveNumber(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function asDateString(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

export async function GET(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const filter = new URL(request.url).searchParams.get('filter') || 'all'
  const ownerScope = resolveFundScope(user, new URL(request.url).searchParams.get('owner_scope'))
  try {
    const loans = await getOrSetMemoryCache(`api:loans:${ownerScope}:${filter}`, 20000, async () => {
      const supabase = createAdminClient()

      let query = supabase
        .from('loans')
        .select('id, borrower_name, fund_owner, start_date, interest_rate, remaining_principal, status')
        .order('created_at', { ascending: false })

      query = applyFundScopeFilter(query, ownerScope)

      if (filter === 'active' || filter === 'closed') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    })

    return NextResponse.json({ loans })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load loans' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const borrowerName = asString(body?.borrower_name)
  const startDate = asDateString(body?.start_date)
  const principal = asPositiveNumber(body?.principal)
  const interestRate = asNonNegativeNumber(body?.interest_rate)
  const notes = asOptionalString(body?.notes)
  const fundOwnerRaw = asString(body?.fund_owner)

  if (!borrowerName || !startDate || !principal || interestRate === null || !isFundOwnerKey(fundOwnerRaw)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  if (!canAccessFundOwner(user, fundOwnerRaw)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createAdminClient()

  try {
    const { data: loan, error: loanError } = await supabase
      .from('loans')
      .insert({
        borrower_name: borrowerName,
        start_date: startDate,
        principal,
        remaining_principal: principal,
        interest_rate: interestRate,
        fund_owner: fundOwnerRaw,
        notes,
        status: 'active',
      })
      .select('id')
      .single()

    if (loanError) throw loanError

    const { error: txnError } = await supabase.from('loan_transactions').insert({
      loan_id: loan.id,
      type: 'principal',
      amount: principal,
      transaction_date: startDate,
      note: 'ปล่อยกู้ครั้งแรก',
    })
    if (txnError) throw txnError

    const { error: notificationError } = await insertNotificationRecord(supabase, {
      type: 'loan_created',
      message: `ปล่อยกู้ใหม่ ${borrowerName} ฿${principal.toLocaleString('th-TH')}`,
      action_url: createNotificationAction(`/loans/${loan.id}`, [...getNotificationRecipientsForFundOwner(fundOwnerRaw)]),
    })
    if (notificationError) throw notificationError

    return NextResponse.json({ loanId: loan.id })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create loan' }, { status: 500 })
  }
}
