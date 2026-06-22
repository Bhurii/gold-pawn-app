import { NextRequest, NextResponse } from 'next/server'
import { insertActionAudit, type ActionAuditEntityType, type ActionAuditEventType, type ActionAuditParentType } from '@/lib/action-audit'
import { createAdminClient } from '@/lib/server/admin'
import { canAccessFundOwner } from '@/lib/server/fund-access'
import { readSessionFromRequest } from '@/lib/server/app-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type InterestPaymentRow = {
  id: string
  pawn_id: string
  payment_date: string
  amount: number
  slip_url: string | null
  note: string | null
}

type LoanTxnRow = {
  id: string
  loan_id: string
  type: string
  transaction_date: string
  amount: number
  slip_url: string | null
  note: string | null
}

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

async function resolveParentFundOwner(supabase: any, parentType: ActionAuditParentType, parentId: string) {
  if (parentType === 'pawn') {
    const result = await supabase.from('pawns').select('id, fund_owner').eq('id', parentId).maybeSingle()
    return {
      data: result.data ? { id: result.data.id as string, fund_owner: result.data.fund_owner as string } : null,
      error: result.error,
    }
  }

  const result = await supabase.from('loans').select('id, fund_owner').eq('id', parentId).maybeSingle()
  return {
    data: result.data ? { id: result.data.id as string, fund_owner: result.data.fund_owner as string } : null,
    error: result.error,
  }
}

async function syncLoanState(supabase: any, loanId: string) {
  const { data: loan, error: loanError } = await supabase
    .from('loans')
    .select('id, principal')
    .eq('id', loanId)
    .maybeSingle()

  if (loanError) throw loanError
  if (!loan) throw new Error('Loan not found')

  const { data: txns, error: txnError } = await supabase
    .from('loan_transactions')
    .select('type, amount')
    .eq('loan_id', loanId)

  if (txnError) throw txnError

  const principalPaid = (txns || []).reduce((sum: number, item: { type?: string; amount?: number | null }) => {
    if (item.type === 'principal_payment' || item.type === 'close') {
      return sum + Number(item.amount || 0)
    }
    return sum
  }, 0)

  const remaining = Math.max(0, Number(loan.principal || 0) - principalPaid)
  const status = remaining <= 0 ? 'closed' : 'active'

  const updateResult = await supabase
    .from('loans')
    .update({ remaining_principal: remaining, status })
    .eq('id', loanId)

  if (updateResult.error) throw updateResult.error
}

export async function POST(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const mode = asString(body?.mode) as ActionAuditEventType
  const entityType = asString(body?.entity_type) as ActionAuditEntityType
  const recordId = asString(body?.record_id)
  const parentType = asString(body?.parent_type) as ActionAuditParentType
  const parentId = asString(body?.parent_id)
  const remark = asOptionalString(body?.remark)
  const changes = body && typeof body === 'object' && 'changes' in body && body.changes && typeof body.changes === 'object'
    ? body.changes as Record<string, unknown>
    : {}

  if (!recordId || !parentId || !['update', 'delete'].includes(mode) || !['interest_payment', 'loan_transaction'].includes(entityType) || !['pawn', 'loan'].includes(parentType)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const parentResult = await resolveParentFundOwner(supabase, parentType, parentId)
  if (parentResult.error) {
    return NextResponse.json({ error: parentResult.error.message }, { status: 500 })
  }
  if (!parentResult.data || !canAccessFundOwner(user, parentResult.data.fund_owner)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    if (entityType === 'interest_payment') {
      const { data: current, error: currentError } = await supabase
        .from('interest_payments')
        .select('id, pawn_id, payment_date, amount, slip_url, note')
        .eq('id', recordId)
        .maybeSingle()

      if (currentError) throw currentError
      if (!current || current.pawn_id !== parentId) {
        return NextResponse.json({ error: 'Interest payment not found' }, { status: 404 })
      }

      if (mode === 'update') {
        const amount = changes.amount === undefined ? Number(current.amount || 0) : asPositiveNumber(changes.amount)
        const paymentDate = changes.payment_date === undefined ? current.payment_date : asDateString(changes.payment_date)
        const note = changes.note === undefined ? current.note : asOptionalString(changes.note)

        if (!amount || !paymentDate) {
          return NextResponse.json({ error: 'ข้อมูลแก้ไขไม่ถูกต้อง' }, { status: 400 })
        }

        const { data: updated, error: updateError } = await supabase
          .from('interest_payments')
          .update({ amount, payment_date: paymentDate, note })
          .eq('id', recordId)
          .select('id, pawn_id, payment_date, amount, slip_url, note')
          .single()

        if (updateError) throw updateError

        const auditResult = await insertActionAudit(supabase, {
          entity_type: 'interest_payment',
          entity_id: recordId,
          parent_type: 'pawn',
          parent_id: parentId,
          event_type: 'update',
          actor_user_key: user.user_key,
          actor_display_name: user.display_name,
          remark,
          before_data: current,
          after_data: updated,
        })

        if (auditResult.error) throw auditResult.error
        return NextResponse.json({ record: updated })
      }

      const deleteResult = await supabase.from('interest_payments').delete().eq('id', recordId)
      if (deleteResult.error) throw deleteResult.error

      const auditResult = await insertActionAudit(supabase, {
        entity_type: 'interest_payment',
        entity_id: recordId,
        parent_type: 'pawn',
        parent_id: parentId,
        event_type: 'delete',
        actor_user_key: user.user_key,
        actor_display_name: user.display_name,
        remark,
        before_data: current,
        after_data: null,
      })

      if (auditResult.error) throw auditResult.error
      return NextResponse.json({ deleted: true })
    }

    const { data: current, error: currentError } = await supabase
      .from('loan_transactions')
      .select('id, loan_id, type, transaction_date, amount, slip_url, note')
      .eq('id', recordId)
      .maybeSingle()

    if (currentError) throw currentError
    if (!current || current.loan_id !== parentId) {
      return NextResponse.json({ error: 'Loan transaction not found' }, { status: 404 })
    }

    if (current.type === 'principal') {
      return NextResponse.json({ error: 'ยังไม่อนุญาตให้แก้ไขรายการปล่อยกู้ตั้งต้น' }, { status: 400 })
    }

    if (mode === 'update') {
      const payload: Record<string, unknown> = {}
      if (changes.note !== undefined) {
        payload.note = asOptionalString(changes.note)
      }
      if (changes.transaction_date !== undefined) {
        const transactionDate = asDateString(changes.transaction_date)
        if (!transactionDate) {
          return NextResponse.json({ error: 'วันที่ไม่ถูกต้อง' }, { status: 400 })
        }
        payload.transaction_date = transactionDate
      }
      if (current.type !== 'close' && changes.amount !== undefined) {
        const amount = asPositiveNumber(changes.amount)
        if (!amount) {
          return NextResponse.json({ error: 'จำนวนเงินไม่ถูกต้อง' }, { status: 400 })
        }
        payload.amount = amount
      }
      if (current.type === 'close' && changes.amount !== undefined) {
        return NextResponse.json({ error: 'รายการปิดหนี้แก้ยอดเงินไม่ได้ ให้ลบแล้วทำใหม่แทน' }, { status: 400 })
      }

      const { data: updated, error: updateError } = await supabase
        .from('loan_transactions')
        .update(payload)
        .eq('id', recordId)
        .select('id, loan_id, type, transaction_date, amount, slip_url, note')
        .single()

      if (updateError) throw updateError

      await syncLoanState(supabase, parentId)

      const auditResult = await insertActionAudit(supabase, {
        entity_type: 'loan_transaction',
        entity_id: recordId,
        parent_type: 'loan',
        parent_id: parentId,
        event_type: 'update',
        actor_user_key: user.user_key,
        actor_display_name: user.display_name,
        remark,
        before_data: current,
        after_data: updated,
      })

      if (auditResult.error) throw auditResult.error
      return NextResponse.json({ record: updated })
    }

    const deleteResult = await supabase.from('loan_transactions').delete().eq('id', recordId)
    if (deleteResult.error) throw deleteResult.error

    await syncLoanState(supabase, parentId)

    const auditResult = await insertActionAudit(supabase, {
      entity_type: 'loan_transaction',
      entity_id: recordId,
      parent_type: 'loan',
      parent_id: parentId,
      event_type: 'delete',
      actor_user_key: user.user_key,
      actor_display_name: user.display_name,
      remark,
      before_data: current,
      after_data: null,
    })

    if (auditResult.error) throw auditResult.error
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ' }, { status: 500 })
  }
}
