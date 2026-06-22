'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { getSession } from '@/lib/auth'
import {
  canViewAllFunds,
  FUND_OWNER_BADGES,
  FUND_OWNER_BADGE_STYLES,
  FUND_OWNER_LABELS,
  getAccessibleFundOwners,
  isFundOwnerKey,
  type FundOwnerKey,
} from '@/lib/fund-owner'
import { Pawn } from '@/lib/types'

type PawnRow = Pawn & {
  tx_status?: 'pending_transfer' | 'active' | 'pending_redeem' | 'redeemed'
  fund_owner?: FundOwnerKey
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

function OwnerBadge({ owner }: { owner: FundOwnerKey }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        marginTop: 6,
        ...FUND_OWNER_BADGE_STYLES[owner],
      }}
    >
      {FUND_OWNER_BADGES[owner]}
    </span>
  )
}

function getScopeChips(session: ReturnType<typeof getSession>) {
  const owners = getAccessibleFundOwners(session)
  const ownerChips = owners.map((owner) => ({ value: owner, label: FUND_OWNER_LABELS[owner] }))
  return canViewAllFunds(session)
    ? [{ value: 'all' as const, label: 'ทั้งหมด' }, ...ownerChips]
    : ownerChips
}

export default function PawnList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const session = useMemo(() => getSession(), [])
  const canViewAll = canViewAllFunds(session)
  const defaultScope: 'all' | FundOwnerKey = canViewAllFunds(session) ? 'all' : (session?.user_key || 'tony')
  const [pawns, setPawns] = useState<PawnRow[]>([])
  const [adjustedMap, setAdjustedMap] = useState<Map<string, AdjustedInfo>>(new Map())
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<PawnFilter>(normalizeFilter(searchParams.get('filter')))
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '')
  const [ownerScope, setOwnerScope] = useState<'all' | FundOwnerKey>(() => {
    const raw = searchParams.get('owner_scope')
    if (raw === 'all') return canViewAllFunds(session) ? 'all' : defaultScope
    return isFundOwnerKey(raw) ? raw : defaultScope
  })
  const scopeChips = useMemo(() => getScopeChips(session), [session])

  useEffect(() => {
    setFilter(normalizeFilter(searchParams.get('filter')))
    setSearch(searchParams.get('search') || '')
    const nextScope = searchParams.get('owner_scope')
    if ((nextScope === 'all' && canViewAll) || isFundOwnerKey(nextScope)) {
      setOwnerScope(nextScope)
      return
    }
    setOwnerScope(defaultScope)
  }, [canViewAll, defaultScope, searchParams])

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
    params.set('owner_scope', ownerScope)
    const nextUrl = `/pawns?${params.toString()}`
    const currentUrl = searchParams.toString() ? `/pawns?${searchParams.toString()}` : '/pawns'
    if (nextUrl !== currentUrl) {
      router.replace(nextUrl)
    }
  }, [debouncedSearch, filter, ownerScope, router, searchParams])

  useEffect(() => {
    hydrateFromCache(filter, debouncedSearch, ownerScope)
    void loadPawns()
  }, [filter, debouncedSearch, ownerScope])

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
      params.set('owner_scope', ownerScope)

      const response = await fetch(`/api/pawns?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || 'โหลดข้อมูลตั๋วไม่สำเร็จ')

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
        window.sessionStorage.setItem(
          getCacheKey(filter, debouncedSearch, ownerScope),
          JSON.stringify({ pawns: nextPawns, adjusted: adjustedRows } satisfies PawnListCache),
        )
      }
    } catch {
      setPawns([])
      setAdjustedMap(new Map())
    } finally {
      setLoading(false)
    }
  }

  const specialFilterMeta = useMemo(() => {
    if (filter === 'pending_transfer') return { title: 'รอโอนเงิน', detail: 'กำลังดูรายการที่ยังรอโอนเงินเข้าอยู่' }
    if (filter === 'pending_confirm') return { title: 'รอยืนยันไถ่ถอน', detail: 'กำลังดูรายการที่รอยืนยันการไถ่ถอน' }
    return null
  }, [filter])

  function getBadge(pawn: PawnRow) {
    const adjusted = adjustedMap.get(pawn.id)
    if (pawn.status === 'active') return { className: 'badge-active', label: 'จำนำอยู่' }
    if (adjusted) return { className: 'badge-adjusted', label: adjusted.type === 'topup' ? 'เพิ่มยอดแล้ว' : 'ลดต้นแล้ว' }
    return { className: 'badge-redeemed', label: 'ไถ่ถอนไปแล้ว' }
  }

  function getCacheKey(nextFilter: PawnFilter, nextSearch: string, nextScope: string) {
    return `pawn-list:${nextScope}:${nextFilter}:${nextSearch || '__empty__'}`
  }

  function hydrateFromCache(nextFilter: PawnFilter, nextSearch: string, nextScope: string) {
    if (typeof window === 'undefined') return
    try {
      const raw = window.sessionStorage.getItem(getCacheKey(nextFilter, nextSearch, nextScope))
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
        {scopeChips.length > 1 && (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 700 }}>เจ้าของเงิน</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {scopeChips.map(({ value, label }) => (
                <button key={value} type="button" className="filter-chip" data-active={ownerScope === value} onClick={() => setOwnerScope(value)}>
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 700 }}>ค้นหาเลขตั๋ว</div>
        <input className="input-field" type="text" inputMode="numeric" placeholder="เช่น 23779" value={search} onChange={(event) => setSearch(event.target.value)} />

        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 14, marginBottom: 10, fontWeight: 700 }}>สถานะ</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
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
            <button type="button" onClick={() => setFilter('all')}>ดูทั้งหมด</button>
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
                <Link
                  href={`/pawns/${pawn.id}`}
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    marginBottom: 12,
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      flexShrink: 0,
                      background: 'rgba(232,197,90,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                    }}
                  >
                    💍
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>ตั๋ว #{pawn.ticket_no}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {new Date(pawn.pawn_date).toLocaleDateString('th-TH')}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <OwnerBadge owner={pawn.fund_owner || 'tony'} />
                    </div>
                    {adjusted && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {adjusted.type === 'topup' ? 'เพิ่มยอด' : 'ลดต้น'} {'->'} ตั๋วใหม่ #{adjusted.ticket_no}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--gold)' }}>
                      ฿{pawn.amount.toLocaleString('th-TH')}
                    </div>
                    <span className={badge.className}>{badge.label}</span>
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
