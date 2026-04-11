'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Pawn } from '@/lib/types'

export default function PawnList() {
  const router = useRouter()
  const [pawns, setPawns] = useState<Pawn[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'redeemed'>('all')

  useEffect(() => { loadPawns() }, [])

  async function loadPawns() {
    const { data } = await supabase.from('pawns').select('*').order('created_at', { ascending: false })
    if (data) setPawns(data)
    setLoading(false)
  }

  const filtered = pawns.filter(p => filter === 'all' ? true : p.status === filter)

  return (
    <main className="page-container">
      <div style={{ padding: '52px 0 16px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>รายการทั้งหมด</div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'active', 'redeemed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '7px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600, border: '0.5px solid', cursor: 'pointer', borderColor: filter === f ? 'var(--gold)' : 'var(--border)', background: filter === f ? 'rgba(232,197,90,0.15)' : 'transparent', color: filter === f ? 'var(--gold)' : 'var(--text-muted)' }}>
            {f === 'all' ? 'ทั้งหมด' : f === 'active' ? 'จำนำอยู่' : 'ไถ่ถอนแล้ว'}
          </button>
        ))}
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>ไม่มีรายการ</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(p => (
            <div key={p.id} className="card" onClick={() => router.push(`/pawns/${p.id}`)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: 'rgba(232,197,90,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💍</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>ตั๋ว #{p.ticket_no}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(p.pawn_date).toLocaleDateString('th-TH')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--gold)' }}>฿{p.amount.toLocaleString('th-TH')}</div>
                <span className={p.status === 'active' ? 'badge-active' : 'badge-redeemed'}>
                  {p.status === 'active' ? 'จำนำอยู่' : 'ไถ่ถอนแล้ว'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      
    </main>
  )
}
