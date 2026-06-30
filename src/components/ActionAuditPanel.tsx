'use client'

import type { ActionAuditRow } from '@/lib/action-audit'
import { getFundOwnerLabel, isFundOwnerKey } from '@/lib/fund-owner'
import { fmt, toThaiDateLong } from '@/lib/utils'

const TRACKED_FIELDS = ['amount', 'ticket_no', 'payment_date', 'pawn_date', 'transaction_date', 'fund_owner', 'note', 'notes'] as const

function getFieldLabel(key: string) {
  if (key === 'amount') return 'จำนวนเงิน'
  if (key === 'ticket_no') return 'เลขตั๋ว'
  if (key === 'payment_date') return 'วันที่ตัดดอก'
  if (key === 'pawn_date') return 'วันที่จำนำ'
  if (key === 'transaction_date') return 'วันที่ทำรายการ'
  if (key === 'fund_owner') return 'เจ้าของเงิน'
  if (key === 'note' || key === 'notes') return 'หมายเหตุ'
  return key
}

function formatValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (key === 'amount' && typeof value === 'number') return `฿${fmt(value)}`
  if ((key === 'payment_date' || key === 'pawn_date' || key === 'transaction_date') && typeof value === 'string') {
    return toThaiDateLong(value)
  }
  if (key === 'fund_owner' && typeof value === 'string' && isFundOwnerKey(value)) {
    return getFundOwnerLabel(value)
  }
  return String(value)
}

function getEntityLabel(entityType: ActionAuditRow['entity_type']) {
  if (entityType === 'pawn') return 'ข้อมูลตั๋วจำนำ'
  if (entityType === 'interest_payment') return 'รายการตัดดอก'
  return 'รายการสินเชื่อ'
}

function getChangedKeys(item: ActionAuditRow) {
  const before = item.before_data || {}
  const after = item.after_data || {}

  return Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .filter((key) => TRACKED_FIELDS.includes(key as (typeof TRACKED_FIELDS)[number]))
}

function summarizeAudit(item: ActionAuditRow) {
  const before = item.before_data || {}

  if (item.event_type === 'delete') {
    const amount = typeof before.amount === 'number' ? ` ฿${fmt(before.amount)}` : ''
    return `ลบ${getEntityLabel(item.entity_type)}${amount}`
  }

  const keys = getChangedKeys(item)
  if (keys.length === 0) {
    return `แก้ไข${getEntityLabel(item.entity_type)}`
  }

  return `แก้ไข${getEntityLabel(item.entity_type)} ${keys.map(getFieldLabel).join(', ')}`
}

export default function ActionAuditPanel({ audits }: { audits: ActionAuditRow[] }) {
  if (audits.length === 0) return null

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>ประวัติการแก้ไข</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {audits.map((item, index) => {
          const before = item.before_data || {}
          const after = item.after_data || {}
          const changedKeys = getChangedKeys(item)

          return (
            <div key={item.id} style={{ paddingBottom: index < audits.length - 1 ? 12 : 0, borderBottom: index < audits.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{summarizeAudit(item)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                    {item.actor_display_name} · {new Date(item.created_at).toLocaleString('th-TH')}
                  </div>
                </div>
                <span className={item.event_type === 'delete' ? 'badge-redeemed' : 'badge-pending'}>
                  {item.event_type === 'delete' ? 'ลบ' : 'แก้ไข'}
                </span>
              </div>
              {item.remark ? (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
                  เหตุผล: {item.remark}
                </div>
              ) : null}
              {item.event_type === 'update' && changedKeys.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                  {changedKeys.map((key) => (
                    <div key={key} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{getFieldLabel(key)}</span>
                      {' · '}
                      <span>{formatValue(key, before[key])}</span>
                      {' -> '}
                      <span style={{ color: 'var(--gold-light)' }}>{formatValue(key, after[key])}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
