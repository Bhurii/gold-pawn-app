'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface NotifItem {
  id: string
  type: string
  message: string
  pawn_id?: string
  created_at: string
  is_read: boolean
  action_url?: string
}

interface Props {
  pendingPawns: any[]
  pendingRedeems: any[]
}

export default function NotificationBell({ pendingPawns, pendingRedeems }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const total = pendingPawns.length + pendingRedeems.length

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (total === 0) return null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 26 }}>🔔</span>
        <span style={{
          position: 'absolute', top: 0, right: 0,
          background: 'linear-gradient(135deg,#C9922A,#F2C94C)',
          color: '#080808', fontSize: 11, fontWeight: 800,
          borderRadius: 99, minWidth: 18, height: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 4px', lineHeight: 1
        }}>
          {total}
        </span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 46, right: 0,
          background: 'var(--black-800)', border: '1px solid var(--border)',
          borderRadius: 18, padding: 8, minWidth: 280, zIndex: 100,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 12px 8px', fontWeight: 700, letterSpacing: 0.5 }}>
            การแจ้งเตือน
          </div>

          {pendingPawns.map(p => (
            <div key={p.id}
              onClick={() => { router.push(`/pawns/${p.id}`); setOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', background: 'rgba(242,201,76,0.08)', marginBottom: 6 }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>🪿</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>มีคนมาขายห่านจ้า!</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ตั๋ว #{p.ticket_no} · ฿{p.amount?.toLocaleString('th-TH')} · โอนตังเลย
                </div>
              </div>
              <span style={{ fontSize: 16, color: 'var(--gold)', flexShrink: 0 }}>›</span>
            </div>
          ))}

          {pendingRedeems.map(r => (
            <div key={r.id}
              onClick={() => { router.push(`/redeem/confirm/${r.id}`); setOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', background: 'rgba(111,207,111,0.08)', marginBottom: 6 }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>🐣</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#6fcf6f' }}>ขายห่านได้แล้ว!</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ตั๋ว #{r.pawns?.ticket_no} · รอยืนยัน
                </div>
              </div>
              <span style={{ fontSize: 16, color: '#6fcf6f', flexShrink: 0 }}>›</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
