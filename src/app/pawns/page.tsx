'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Pawn } from '@/lib/types'

type PawnRow = Pawn & {
  tx_status?: 'pending_transfer' | 'active' | 'pending_redeem' | 'redeemed'
}

export default function PawnList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pawns, setPawns] = useState<PawnRow[]>([])
  const [loading, setLoading] = useState(true)
  const filterFromUrl = searchParams.get('filter')
  const initialFilter = filterFromUrl === 'pending_transfer' || filterFromUrl === 'pending_confirm'
    ? filterFromUrl
    : 'all'
  const [filter, setFilter] = useState<'all' | 'active' | 'redeemed' | 'pending_transfer' | 'pending_confirm'>(initialFilter)
  const [search, setSearch] = useState(searchParams.get('search') || '')

  useEffect(() => { loadPawns() }, [])

  async function loadPawns() {
    const { data } = await supabase.from('pawns').select('*').order('created_at', { ascending: false })
    if (data) setPawns(data)
    setLoading(false)
  }

  const filtered = pawns.filter((pawn) => {
    const matchFilter =
      filter === 'all'
        ? true
        : filter === 'pending_transfer'
          ? pawn.tx_status === 'pending_transfer'
          : filter === 'pending_confirm'
            ? pawn.tx_status === 'pending_redeem'
            : pawn.status === filter
    const keyword = search.trim().toLowerCase()
    const matchSearch = keyword ? String(pawn.ticket_no).toLowerCase().includes(keyword) : true
    return matchFilter && matchSearch
  })

  return (
    <main className="page-container">
      <div style={{ padding: '52px 0 16px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>🔍 ค้นหา / ดูฝูงห่าน</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
          ค้นหาเลขตั๋วก่อน แล้วค่อยเลือกงานต่อจากตั๋วนั้น
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12, padding: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 700 }}>ค้นหาเลขตั๋ว</div>
        <input
          className="input-field"
          type="text"
          inputMode="numeric"
          placeholder="เช่น 23779"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>
          {([
            ['all', 'ทั้งหมด'],
            ['active', 'จำนำอยู่'],
            ['pending_transfer', 'รอโอนเงิน'],
            ['pending_confirm', 'รอยืนยันคืน'],
          ] as const).map(([value, label]) => (
            <button key={value} onClick={() => setFilter(value)} className="filter-chip" data-active={filter === value} type="button">
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
          {search.trim() ? 'ไม่พบเลขตั๋วที่ค้นหา' : 'ไม่มีรายการ'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((pawn) => (
            <div key={pawn.id} className="card" style={{ padding: 16 }}>
              <div onClick={() => router.push(`/pawns/${pawn.id}`)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: 'rgba(232,197,90,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  💍
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>ตั๋ว #{pawn.ticket_no}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {new Date(pawn.pawn_date).toLocaleDateString('th-TH')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--gold)' }}>฿{pawn.amount.toLocaleString('th-TH')}</div>
                  <span className={
                    pawn.tx_status === 'pending_transfer'
                      ? 'badge-pending'
                      : pawn.tx_status === 'pending_redeem'
                        ? 'badge-pending'
                        : pawn.status === 'active'
                          ? 'badge-active'
                          : 'badge-redeemed'
                  }>
                    {pawn.tx_status === 'pending_transfer'
                      ? 'รอโอน'
                      : pawn.tx_status === 'pending_redeem'
                        ? 'รอยืนยัน'
                        : pawn.status === 'active'
                          ? 'จำนำอยู่'
                          : 'ไถ่ถอนไปแล้ว'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <button type="button" className="quick-link" onClick={() => router.push(`/interest?pawn_id=${pawn.id}`)} disabled={pawn.status !== 'active' || pawn.tx_status !== 'active'}>
                  <span>🥚 เก็บไข่</span>
                </button>
                <button type="button" className="quick-link" onClick={() => router.push(`/redeem?pawn_id=${pawn.id}`)} disabled={pawn.status !== 'active' || pawn.tx_status !== 'active'}>
                  <span>🐣 คืนห่าน</span>
                </button>
                <button type="button" className="quick-link" onClick={() => router.push(`/pawns/${pawn.id}`)}>
                  <span>📋 ดูรายละเอียด</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <nav className="bottom-nav">
        <a href="/" className="nav-item"><span className="nav-icon">🐣</span>หน้าแรก</a>
        <a href="/pawns" className="nav-item active"><span className="nav-icon">📋</span>ฝูงห่าน</a>
        <a href="/loans" className="nav-item"><span className="nav-icon">🍊</span>สวนส้ม</a>
        <a href="/report" className="nav-item"><span className="nav-icon">📊</span>ผลผลิต</a>
      </nav>
    </main>
  )
}
