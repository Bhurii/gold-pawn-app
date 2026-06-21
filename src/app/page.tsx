'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { canViewAllFunds, FUND_OWNER_BADGES, getDefaultFundScope } from '@/lib/fund-owner'
import { getSession, type AppUser } from '@/lib/auth'
import { fmt } from '@/lib/utils'
import BottomNav from '@/components/BottomNav'
import NotificationBell from '@/components/NotificationBell'

type PendingRedeem = {
  id: string
  pawn_id: string
  status: string
  pawns?: { ticket_no?: string | null; amount?: number | null } | null
}

type PendingPawn = {
  id: string
  ticket_no: string
  amount: number
  tx_status: string
}

type DashboardPayload = {
  budget: number
  activePawns: number
  activeAmount: number
  activeLoans: number
  loanAmount: number
  monthInterest: number
  pendingPawns: PendingPawn[]
  pendingRedeems: PendingRedeem[]
  user: AppUser
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<AppUser | null>(() => getSession())
  const [budget, setBudget] = useState(0)
  const [activePawns, setActivePawns] = useState(0)
  const [activeAmount, setActiveAmount] = useState(0)
  const [activeLoans, setActiveLoans] = useState(0)
  const [loanAmount, setLoanAmount] = useState(0)
  const [monthInterest, setMonthInterest] = useState(0)
  const [pendingPawns, setPendingPawns] = useState<PendingPawn[]>([])
  const [pendingRedeems, setPendingRedeems] = useState<PendingRedeem[]>([])
  const [loading, setLoading] = useState(true)
  const [ownerScope, setOwnerScope] = useState<'all' | 'tony' | 'louise' | 'phat'>(() => {
    const session = getSession()
    return getDefaultFundScope(session)
  })

  useEffect(() => {
    const session = getSession()
    if (session) {
      setUser(session)
      setOwnerScope(getDefaultFundScope(session))
    }
  }, [])

  useEffect(() => {
    hydrateFromCache(ownerScope)
    void loadDashboard(ownerScope)
    router.prefetch('/pawns')
    router.prefetch('/loans')
    router.prefetch('/report')
    router.prefetch('/settings')
    router.prefetch('/pawn/new')
    router.prefetch('/loans/new')
  }, [ownerScope, router])

  function getCacheKey(scope: string) {
    return `dashboard:home:${scope}`
  }

  function hydrateFromCache(scope: string) {
    if (typeof window === 'undefined') return

    try {
      const raw = window.sessionStorage.getItem(getCacheKey(scope))
      if (!raw) return
      const cached = JSON.parse(raw) as DashboardPayload
      setBudget(Number(cached.budget || 0))
      setActivePawns(Number(cached.activePawns || 0))
      setActiveAmount(Number(cached.activeAmount || 0))
      setActiveLoans(Number(cached.activeLoans || 0))
      setLoanAmount(Number(cached.loanAmount || 0))
      setMonthInterest(Number(cached.monthInterest || 0))
      setPendingPawns(cached.pendingPawns || [])
      setPendingRedeems(cached.pendingRedeems || [])
      setUser(cached.user || getSession())
      setLoading(false)
    } catch {
      // Ignore invalid cache and refetch.
    }
  }

  async function loadDashboard(scope: string) {
    try {
      const response = await fetch(`/api/dashboard?owner_scope=${encodeURIComponent(scope)}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'โหลดข้อมูลหน้าแรกไม่สำเร็จ')
      }

      const data = payload as DashboardPayload
      setBudget(Number(data.budget || 0))
      setActivePawns(Number(data.activePawns || 0))
      setActiveAmount(Number(data.activeAmount || 0))
      setActiveLoans(Number(data.activeLoans || 0))
      setLoanAmount(Number(data.loanAmount || 0))
      setMonthInterest(Number(data.monthInterest || 0))
      setPendingPawns(data.pendingPawns || [])
      setPendingRedeems(data.pendingRedeems || [])
      setUser(data.user || getSession())
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(getCacheKey(scope), JSON.stringify(data))
      }
    } finally {
      setLoading(false)
    }
  }

  const totalInvested = activeAmount + loanAmount
  const remaining = budget - totalInvested
  const usedPct = budget > 0 ? Math.round((totalInvested / budget) * 100) : 0
  const roi = budget > 0 ? ((monthInterest / budget) * 12 * 100).toFixed(1) : '0.0'
  const pendingCount = pendingPawns.length + pendingRedeems.length
  const showScopeSwitch = canViewAllFunds(user)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--gold)', fontSize: 18 }}>
        Loading...
      </div>
    )
  }

  return (
    <main className="page-container">
      <div style={{ padding: '56px 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 32 }}>🐣</span>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--gold)' }}>ห่านทองคำ</div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            สวัสดี {user?.display_name || 'ผู้ใช้'} · {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NotificationBell />
          <Link href="/settings" style={{ cursor: 'pointer', fontSize: 26, textDecoration: 'none' }}>
            ⚙️
          </Link>
        </div>
      </div>

      {showScopeSwitch && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {([
            [user?.user_key || 'tony', 'ของฉัน'],
            ['all', 'ทั้งหมด'],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" className="filter-chip" data-active={ownerScope === value} onClick={() => setOwnerScope(value)}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="panel-gold" style={{ borderRadius: 22, padding: 22, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          {ownerScope === 'all' ? 'ภาพรวมทุกพอร์ต' : FUND_OWNER_BADGES[ownerScope]}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>เงินลงทุนคงเหลือ</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)' }}>฿{fmt(remaining)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>มูลค่ารวม</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold-light)' }}>฿{fmt(totalInvested)}</div>
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 99, height: 8, marginBottom: 18 }}>
          <div style={{ background: 'linear-gradient(90deg,#C9922A,#F2C94C)', borderRadius: 99, height: 8, width: `${Math.min(usedPct, 100)}%`, transition: 'width 0.5s' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'ตั๋วใช้งาน', value: `${activePawns} ใบ`, href: `/pawns?filter=active&owner_scope=${ownerScope}` },
            { label: 'เงินกู้คงอยู่', value: `${activeLoans} ราย`, href: `/loans?filter=active&owner_scope=${ownerScope}` },
            { label: 'ผลตอบแทนต่อปี', value: `${roi}%`, href: `/report?owner_scope=${ownerScope}` },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: '12px 8px', textAlign: 'center', cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>{item.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{item.label}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="section-label">จำนำทอง</div>
      <div className="card home-action-card" style={{ marginBottom: 14, padding: 16 }}>
        {pendingCount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
            <span className="badge-pending home-status-pill" data-busy>
              {`${pendingCount} งานค้าง`}
            </span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <Link href="/pawn/new" className="btn-primary" style={{ fontSize: 15, padding: '16px 12px', minHeight: 60, textDecoration: 'none' }}>
            🪺 รับจำนำ
          </Link>
          <Link href={`/pawns?owner_scope=${ownerScope}`} className="btn-secondary" style={{ fontSize: 15, padding: '16px 12px', minHeight: 60, background: 'rgba(255,255,255,0.02)', textDecoration: 'none' }}>
            🔍 ค้นหาตั๋ว
          </Link>
        </div>
      </div>

      <div className="section-label">สินเชื่อ</div>
      <div className="card" style={{ marginBottom: 14, padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Link href="/loans/new" className="btn-primary" style={{ fontSize: 15, padding: '16px 12px', textDecoration: 'none' }}>
            🌱 ปล่อยกู้ใหม่
          </Link>
          <Link href={`/loans?owner_scope=${ownerScope}`} className="btn-secondary" style={{ fontSize: 15, padding: '16px 12px', textDecoration: 'none' }}>
            🍊 ดูสินเชื่อ
          </Link>
        </div>
      </div>

      <div className="section-label">รายงาน</div>
      <div className="card" style={{ marginBottom: 14, padding: 16 }}>
        <Link href={`/report?owner_scope=${ownerScope}`} className="btn-secondary" style={{ fontSize: 15, padding: '16px 12px', width: '100%', textDecoration: 'none' }}>
          📊 ดูรายงาน
        </Link>
      </div>

      <BottomNav />
    </main>
  )
}
