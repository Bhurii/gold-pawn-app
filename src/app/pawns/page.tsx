'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Pawn } from '@/lib/types'
import BottomNav from '@/components/BottomNav'

type PawnRow = Pawn & {
  tx_status?: 'pending_transfer' | 'active' | 'pending_redeem' | 'redeemed'
}

type AdjustedInfo = {
  id: string
  ticket_no: string
  amount: number
  type: 'reduce' | 'topup'
}

type PawnFilter = 'all' | 'active' | 'redeemed' | 'pending_transfer' | 'pending_confirm'

const VALID_FILTERS: PawnFilter[] = ['all', 'active', 'redeemed', 'pending_transfer', 'pending_confirm']

function normalizeFilter(value: string | null): PawnFilter {
  return VALID_FILTERS.includes(value as PawnFilter) ? (value as PawnFilter) : 'all'
}

export default function PawnList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pawns, setPawns] = useState<PawnRow[]>([])
  const [adjustedMap, setAdjustedMap] = useState<Map<string, AdjustedInfo>>(new Map())
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<PawnFilter>(normalizeFilter(searchParams.get('filter')))
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '')

  useEffect(() => {
    setFilter(normalizeFilter(searchParams.get('filter')))
    setSearch(searchParams.get('search') || '')
  }, [searchParams])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 250)

    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('filter', filter)
    if (debouncedSearch) params.set('search', debouncedSearch)
    const nextUrl = params.toString() ? `/pawns?${params.toString()}` : '/pawns'
    const currentUrl = searchParams.toString() ? `/pawns?${searchParams.toString()}` : '/pawns'
    if (nextUrl !== currentUrl) {
      router.replace(nextUrl)
    }
  }, [debouncedSearch, filter, router, searchParams])

  useEffect(() => {
    void loadPawns()
  }, [filter, debouncedSearch])

  async function loadPawns() {
    setLoading(true)

    let query = supabase
      .from('pawns')
      .select('id, ticket_no, pawn_date, amount, status, tx_status, renewed_from_id, renewal_principal_paid, created_at')
      .order('created_at', { ascending: false })

    if (filter === 'pending_transfer') {
      query = query.eq('tx_status', 'pending_transfer')
    } else if (filter === 'pending_confirm') {
      query = query.eq('tx_status', 'pending_redeem')
    } else if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    if (debouncedSearch) {
      query = query.ilike('ticket_no', `%${debouncedSearch}%`)
    }

    const { data } = await query
    const nextPawns = (data || []) as PawnRow[]
    setPawns(nextPawns)

    const renewedFromIds = nextPawns.map((pawn) => pawn.id)
    if (renewedFromIds.length === 0) {
      setAdjustedMap(new Map())
      setLoading(false)
      return
    }

    const { data: linked } = await supabase
      .from('pawns')
      .select('id, renewed_from_id, ticket_no, amount, renewal_principal_paid')
      .in('renewed_from_id', renewedFromIds)

    const nextAdjustedMap = new Map<string, AdjustedInfo>()
    ;(linked || []).forEach((pawn) => {
      if (!pawn.renewed_from_id) return
      nextAdjustedMap.set(pawn.renewed_from_id, {
        id: pawn.id,
        ticket_no: pawn.ticket_no,
        amount: pawn.amount,
        type: Number(pawn.renewal_principal_paid) < 0 ? 'topup' : 'reduce',
      })
    })

    setAdjustedMap(nextAdjustedMap)
    setLoading(false)
  }

  const specialFilterMeta = useMemo(() => {
    if (filter === 'pending_transfer') {
      return { title: 'รอโอนเงิน', detail: 'กำลังดูรายการที่ยังรอโอนเงินเข้าอยู่' }
    }
    if (filter === 'pending_confirm') {
      return { title: 'รอยืนยันไถ่ถอน', detail: 'กำลังดูรายการที่รอยืนยันการไถ่ถอน' }
    }
    return null
  }, [filter])

  function getBadge(pawn: PawnRow) {
    const adjusted = adjustedMap.get(pawn.id)
    if (pawn.status === 'active') return { className: 'badge-active', label: 'จำนำอยู่' }
    if (adjusted) {
      return {
        className: 'badge-adjusted',
        label: adjusted.type === 'topup' ? 'เพิ่มยอดแล้ว' : 'ลดต้นแล้ว',
      }
    }
    return { className: 'badge-redeemed', label: 'ไถ่ถอนไปแล้ว' }
  }

  function clearSpecialFilter() {
    setFilter('all')
  }

  return (
    <main className="page-container">
      <div style={{ padding: '52px 0 16px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>🔍 ค้นหาตั๋ว</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
          ค้นหา ดูสถานะ และกดทำงานต่อจากรายการนั้นได้เลย
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
          onChange={(event) => setSearch(event.target.value)}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>
          {([
            ['all', 'ทั้งหมด'],
            ['active', 'จำนำอยู่'],
            ['redeemed', 'ไถ่ถอนแล้ว'],
          ] as const).map(([value, label]) => (
            <button key={value} onClick={() => setFilter(value)} className="filter-chip" data-active={filter === value} type="button">
              {label}
            </button>
          ))}
        </div>

        {specialFilterMeta && (
          <div className="context-banner">
            <div>
              <strong>กำลังดู: {specialFilterMeta.title}</strong>
              <div><span>{specialFilterMeta.detail}</span></div>
            </div>
            <button type="button" onClick={clearSpecialFilter}>ดูทั้งหมด</button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>Loading...</div>
      ) : pawns.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
          {debouncedSearch ? 'ไม่พบเลขตั๋วที่ค้นหา' : 'ไม่มีรายการ'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pawns.map((pawn) => {
            const badge = getBadge(pawn)
            const adjusted = adjustedMap.get(pawn.id)

            return (
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
                    {adjusted && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {adjusted.type === 'topup' ? 'เพิ่มยอด' : 'ลดต้น'}{' -> '}ตั๋วใหม่ #{adjusted.ticket_no}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--gold)' }}>฿{pawn.amount.toLocaleString('th-TH')}</div>
                    <span className={badge.className}>
                      {badge.label}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <button type="button" className="quick-link" onClick={() => router.push(`/interest?pawn_id=${pawn.id}`)} disabled={pawn.status !== 'active' || pawn.tx_status !== 'active'}>
                    <span>🥚 ตัดดอก</span>
                  </button>
                  <button type="button" className="quick-link" onClick={() => router.push(`/redeem?pawn_id=${pawn.id}`)} disabled={pawn.status !== 'active' || pawn.tx_status !== 'active'}>
                    <span>🐣 ไถ่ถอน</span>
                  </button>
                  <button type="button" className="quick-link" onClick={() => router.push(`/pawns/${pawn.id}`)}>
                    <span>📋 ดูรายละเอียด</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <BottomNav />
    </main>
  )
}
