'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

type LoanRow = {
  id: string
  borrower_name: string
  start_date: string
  interest_rate: number
  remaining_principal: number
  status: 'active' | 'closed'
}

type LoanListCache = {
  loans: LoanRow[]
}

export default function LoanList() {
  const router = useRouter()
  const [loans, setLoans] = useState<LoanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all')

  useEffect(() => {
    hydrateFromCache(filter)
    void loadLoans()
  }, [filter])

  useEffect(() => {
    loans.slice(0, 8).forEach((loan) => {
      router.prefetch(`/loans/${loan.id}`)
    })
    router.prefetch('/')
    router.prefetch('/loans/new')
  }, [loans, router])

  async function loadLoans() {
    setLoading((current) => (loans.length === 0 ? true : current))
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('filter', filter)

      const response = await fetch(`/api/loans${params.toString() ? `?${params.toString()}` : ''}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'โหลดข้อมูลสินเชื่อไม่สำเร็จ')
      }

      const nextLoans = (payload?.loans || []) as LoanRow[]
      setLoans(nextLoans)
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(getCacheKey(filter), JSON.stringify({ loans: nextLoans } satisfies LoanListCache))
      }
    } catch {
      setLoans([])
    } finally {
      setLoading(false)
    }
  }

  function getCacheKey(nextFilter: 'all' | 'active' | 'closed') {
    return `loan-list:${nextFilter}`
  }

  function hydrateFromCache(nextFilter: 'all' | 'active' | 'closed') {
    if (typeof window === 'undefined') return

    try {
      const raw = window.sessionStorage.getItem(getCacheKey(nextFilter))
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'active', 'closed'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            style={{
              padding: '8px 18px',
              borderRadius: 99,
              fontSize: 14,
              fontWeight: 600,
              border: '1px solid',
              cursor: 'pointer',
              borderColor: filter === value ? 'var(--gold)' : 'var(--border)',
              background: filter === value ? 'rgba(242,201,76,0.15)' : 'transparent',
              color: filter === value ? 'var(--gold)' : 'var(--text-muted)',
            }}
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
