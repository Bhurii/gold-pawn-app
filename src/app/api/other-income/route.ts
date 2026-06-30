import { NextRequest, NextResponse } from 'next/server'
import { createNotificationAction } from '@/lib/notification-meta'
import { insertNotificationRecord } from '@/lib/notification-store'
import { createAdminClient } from '@/lib/server/admin'
import { readSessionFromRequest } from '@/lib/server/app-session'

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

export async function GET(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('other_income')
    .select('id, income_date, amount, source, note')
    .order('income_date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ list: data || [] })
}

export async function POST(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const incomeDate = asDateString(body?.income_date)
  const amount = asPositiveNumber(body?.amount)
  const source = asString(body?.source)
  const note = asOptionalString(body?.note)

  if (!incomeDate || !amount || !source) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    const { error: incomeError } = await supabase.from('other_income').insert({
      income_date: incomeDate,
      amount,
      source,
      note,
    })
    if (incomeError) throw incomeError

    const { error: notificationError } = await insertNotificationRecord(supabase, {
      type: 'other_income_added',
      message: `มีรายได้ใหม่ ${source} ฿${amount.toLocaleString('th-TH')}`,
      action_url: createNotificationAction('/other-income', ['all']),
    })
    if (notificationError) throw notificationError

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save other income' }, { status: 500 })
  }
}
