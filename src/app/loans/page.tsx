'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { canViewAllFunds, FUND_OWNER_BADGES, FUND_OWNER_BADGE_STYLES, getOwnerScopeOptions, isFundOwnerKey, type FundOwnerKey } from '@/lib/fund-owner'
import { getSession } from '@/lib/auth'

type LoanRow = {
  id: string
  borrower_name: string
  fund_owner?: FundOwnerKey
  start_date: string
  interest_rate: number
  remaining_principal: number
  status: 'active' | 'closed'
}

type LoanListCache = {
  loans: LoanRow[]
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

export default function LoanList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const session = getSession()
  const defaultScope: FundOwnerKey = session?.user_key || 'tony'
  const [loans, setLoans] = useState<LoanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>((searchParams.get('filter') as 'all' | 'active' | 'closed') || 'all')
  const [ownerScope, setOwnerScope] = useState<'all' | FundOwnerKey>(() => {
    const raw = searchParams.get('owner_scope')
    if (raw === 'all') return canViewAllFunds(session) ? 'all' : defaultScope
    return isFundOwnerKey(raw) ? raw : defaultScope
  })

  useEffect(() => {
    hydrateFromCache(filter, ownerScope)
    void loadLoans()
  }, [filter, ownerScope])

  useEffect(() => {
    loans.slice(0, 8).forEach((loan) => {
      router.prefetch(`/loans/${loan.id}`)
    })
    router.prefetch('/')
    router.prefetch('/loans/new')
  }, [loans, router])

  useEffect(() => {
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('filter', filter)
    params.set('owner_scope', ownerScope)
    const nextUrl = `/loans?${params.toString()}`
    const currentUrl = searchParams.toString() ? `/loans?${searchParams.toString()}` : '/loans'
    if (nextUrl !== currentUrl) {
      router.replace(nextUrl)
    }
  }, [filter, ownerScope, router, searchParams])

  async function loadLoans() {
    setLoading((current) => (loans.length === 0 ? true : current))
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('filter', filter)
      params.set('owner_scope', ownerScope)

      const response = await fetch(`/api/loans?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || 'โหลดข้อมูลสินเชื่อไม่สำเร็จ')

      const nextLoans = (payload?.loans || []) as LoanRow[]
      setLoans(nextLoans)
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(getCacheKey(filter, ownerScope), JSON.stringify({ loans: nextLoans } satisfies LoanListCache))
      }
    } catch {
      setLoans([])
    } finally {
      setLoading(false)
    }
  }

  function getCacheKey(nextFilter: 'all' | 'active' | 'closed', nextScope: string) {
    return `loan-list:${nextScope}:${nextFilter}`
  }

  function hydrateFromCache(nextFilter: 'all' | 'active' | 'closed', nextScope: string) {
    if (typeof window === 'undefined') return
    try {
      const raw = window.sessionStorage.getItem(getCacheKey(nextFilter, nextScope))
      if (!raw) return
      const cached = JSON.parse(raw) as LoanListCache
      setLoans(cached.loans || [])
      setLoading(false)
    } catch {
      // Ignore invalid cache and refetch.
    }
  }

  const fmt = (value: number) => value.toLocaleString('th-TH')

  return (
    <main className="page-container">
      <div style={{ padding: '56px 0 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/" style={{ color: 'var(--gold)', fontSize: 26, cursor: 'pointer', textDecoration: 'none' }}>←</Link>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gold)' }}>สินเชื่อ</div>
        <Link href="/loans/new" style={{ marginLeft: 'auto', background: 'linear-gradient(135deg,#C9922A,#F2C94C)', color: '#080808', borderRadius: 12, padding: '8px 18px', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
          + ใหม่
        </Link>
      </div>

      {canViewAllFunds(session) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {getOwnerScopeOptions(session).map(({ value, label }) => (
            <button key={value} type="button" className="filter-chip" data-active={ownerScope === value} onClick={() => setOwnerScope(value)}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'active', 'closed'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className="filter-chip"
            data-active={filter === value}
            type="button"
          >
            {value === 'all' ? 'ทั้งหมด' : value === 'active' ? 'ค้างอยู่' : 'ปิดแล้ว'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--gold)', padding: 40, fontSize: 18 }}>กำลังโหลด...</div>
      ) : loans.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40, fontSize: 16 }}>ไม่มีรายการ</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loans.map((loan) => (
            <Link key={loan.id} href={`/loans/${loan.id}`} className="card" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', color: 'inherit' }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(242,201,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>👤</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{loan.borrower_name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>เริ่ม {new Date(loan.start_date).toLocaleDateString('th-TH')}</div>
                <div style={{ marginTop: 4 }}>
                  <OwnerBadge owner={loan.fund_owner || 'tony'} />
                </div>
                {loan.interest_rate > 0 && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>ดอก {loan.interest_rate}%/เดือน</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--gold)' }}>฿{fmt(loan.remaining_principal)}</div>
                <span className={loan.status === 'active' ? 'badge-active' : 'badge-closed'}>
                  {loan.status === 'active' ? 'ค้างอยู่' : 'ปิดแล้ว'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <BottomNav />
    </main>
  )
}
