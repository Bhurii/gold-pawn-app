'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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

type PawnListCache = {
  pawns: PawnRow[]
  adjusted: Array<AdjustedInfo & { renewed_from_id?: string | null; renewal_principal_paid?: number | null }>
}

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
    hydrateFromCache(filter, debouncedSearch)
    void loadPawns()
  }, [filter, debouncedSearch])

  useEffect(() => {
    pawns.slice(0, 8).forEach((pawn) => {
      router.prefetch(`/pawns/${pawn.id}`)
      if (pawn.status === 'active' && pawn.tx_status === 'active') {
        router.prefetch(`/interest?pawn_id=${pawn.id}`)
        router.prefetch(`/redeem?pawn_id=${pawn.id}`)
      }
    })
  }, [pawns, router])

  async function loadPawns() {
    setLoading((current) => (pawns.length === 0 ? true : current))
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('filter', filter)
      if (debouncedSearch) params.set('search', debouncedSearch)

      const response = await fetch(`/api/pawns${params.toString() ? `?${params.toString()}` : ''}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'โหลดข้อมูลตั๋วไม่สำเร็จ')
      }

      const nextPawns = (payload?.pawns || []) as PawnRow[]
      setPawns(nextPawns)

      const adjustedRows = ((payload?.adjusted || []) as Array<AdjustedInfo & { renewed_from_id?: string | null; renewal_principal_paid?: number | null }>)
      const nextAdjustedMap = new Map<string, AdjustedInfo>()
      adjustedRows.forEach((pawn) => {
        if (!pawn.renewed_from_id) return
        nextAdjustedMap.set(pawn.renewed_from_id, {
          id: pawn.id,
          ticket_no: pawn.ticket_no,
          amount: pawn.amount,
          type: Number(pawn.renewal_principal_paid) < 0 ? 'topup' : 'reduce',
        })
      })

      setAdjustedMap(nextAdjustedMap)
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(getCacheKey(filter, debouncedSearch), JSON.stringify({ pawns: nextPawns, adjusted: adjustedRows } satisfies PawnListCache))
      }
    } catch {
      setPawns([])
      setAdjustedMap(new Map())
    } finally {
      setLoading(false)
    }
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

  function getCacheKey(nextFilter: PawnFilter, nextSearch: string) {
    return `pawn-list:${nextFilter}:${nextSearch || '__empty__'}`
  }

  function hydrateFromCache(nextFilter: PawnFilter, nextSearch: string) {
    if (typeof window === 'undefined') return

    try {
      const raw = window.sessionStorage.getItem(getCacheKey(nextFilter, nextSearch))
      if (!raw) return
      const cached = JSON.parse(raw) as PawnListCache
      setPawns(cached.pawns || [])

      const nextAdjustedMap = new Map<string, AdjustedInfo>()
      ;(cached.adjusted || []).forEach((pawn) => {
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
    } catch {
      // Ignore invalid cache and refetch.
    }
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
                <Link href={`/pawns/${pawn.id}`} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, textDecoration: 'none', color: 'inherit' }}>
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
                </Link>

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
