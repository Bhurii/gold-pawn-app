'use client'

import type { ActionAuditRow } from '@/lib/action-audit'
import { fmt, toThaiDateLong } from '@/lib/utils'

function getFieldLabel(key: string) {
  if (key === 'amount') return 'จำนวนเงิน'
  if (key === 'payment_date') return 'วันที่ตัดดอก'
  if (key === 'transaction_date') return 'วันที่ทำรายการ'
  if (key === 'note') return 'หมายเหตุ'
  return key
}

function formatValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (key === 'amount' && typeof value === 'number') return `฿${fmt(value)}`
  if ((key === 'payment_date' || key === 'transaction_date') && typeof value === 'string') return toThaiDateLong(value)
  return String(value)
}

function summarizeAudit(item: ActionAuditRow) {
  const before = item.before_data || {}
  const after = item.after_data || {}

  if (item.event_type === 'delete') {
    const amount = typeof before.amount === 'number' ? ` ฿${fmt(before.amount)}` : ''
    return `ลบ${item.entity_type === 'interest_payment' ? 'รายการตัดดอก' : 'รายการสินเชื่อ'}${amount}`
  }

  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .filter((key) => ['amount', 'payment_date', 'transaction_date', 'note'].includes(key))

  if (keys.length === 0) {
    return `แก้ไข${item.entity_type === 'interest_payment' ? 'รายการตัดดอก' : 'รายการสินเชื่อ'}`
  }

  return `แก้ไข${item.entity_type === 'interest_payment' ? 'รายการตัดดอก' : 'รายการสินเชื่อ'} ${keys.map(getFieldLabel).join(', ')}`
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
          const changedKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
            .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
            .filter((key) => ['amount', 'payment_date', 'transaction_date', 'note'].includes(key))

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
