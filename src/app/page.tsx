'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
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

export default function Dashboard() {
  const router = useRouter()
  const user = getSession()
  const [budget, setBudget] = useState(0)
  const [activePawns, setActivePawns] = useState(0)
  const [activeAmount, setActiveAmount] = useState(0)
  const [activeLoans, setActiveLoans] = useState(0)
  const [loanAmount, setLoanAmount] = useState(0)
  const [monthInterest, setMonthInterest] = useState(0)
  const [pendingPawns, setPendingPawns] = useState<PendingPawn[]>([])
  const [pendingRedeems, setPendingRedeems] = useState<PendingRedeem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadDashboard()
    router.prefetch('/pawn/new')
    router.prefetch('/loans/new')
  }, [router])

  async function loadDashboard() {
    try {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const [
        { data: settings },
        { data: pawns },
        { data: pendingR },
        { data: loans },
        { data: interests },
        { data: redemptions },
        { data: loanTxns },
      ] = await Promise.all([
        supabase.from('settings').select('invest_budget').single(),
        supabase.from('pawns').select('id, ticket_no, amount, tx_status').eq('status', 'active'),
        supabase.from('redemptions').select('id, pawn_id, status, pawns(ticket_no, amount)').eq('status', 'pending_confirm'),
        supabase.from('loans').select('id, remaining_principal').eq('status', 'active'),
        supabase.from('interest_payments').select('amount').gte('payment_date', firstDay),
        supabase.from('redemptions').select('interest_last').gte('redeem_date', firstDay),
        supabase.from('loan_transactions').select('amount').eq('type', 'interest').gte('transaction_date', firstDay),
      ])

      if (settings) setBudget(settings.invest_budget)
      if (pawns) {
        const activeReadyPawns = pawns.filter((pawn) => pawn.tx_status === 'active')
        setActivePawns(activeReadyPawns.length)
        setActiveAmount(activeReadyPawns.reduce((sum, pawn) => sum + pawn.amount, 0))
        setPendingPawns(pawns.filter((pawn) => pawn.tx_status === 'pending_transfer'))
      }
      if (pendingR) {
        setPendingRedeems(pendingR.map((redeem) => ({
          ...redeem,
          pawns: Array.isArray(redeem.pawns) ? redeem.pawns[0] ?? null : redeem.pawns,
        })))
      }
      if (loans) {
        setActiveLoans(loans.length)
        setLoanAmount(loans.reduce((sum, loan) => sum + loan.remaining_principal, 0))
      }
      let totalInterest = 0
      if (interests) totalInterest += interests.reduce((sum, interest) => sum + interest.amount, 0)
      if (redemptions) totalInterest += redemptions.reduce((sum, redemption) => sum + (redemption.interest_last || 0), 0)
      if (loanTxns) totalInterest += loanTxns.reduce((sum, txn) => sum + txn.amount, 0)
      setMonthInterest(totalInterest)
    } finally {
      setLoading(false)
    }
  }

  const totalInvested = activeAmount + loanAmount
  const remaining = budget - totalInvested
  const usedPct = budget > 0 ? Math.round((totalInvested / budget) * 100) : 0
  const roi = budget > 0 ? ((monthInterest / budget) * 12 * 100).toFixed(1) : '0.0'
  const pendingCount = pendingPawns.length + pendingRedeems.length

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
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--gold)', letterSpacing: -0.5 }}>ห่านทองคำ</div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            สวัสดี {user?.role === 'owner' ? 'โทนี่' : 'เจ้หลุยส์'} · {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NotificationBell pendingPawns={pendingPawns} pendingRedeems={pendingRedeems} />
          <button onClick={() => router.push('/settings')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 26 }}>
            ⚙️
          </button>
        </div>
      </div>

      <div className="panel-gold" style={{ borderRadius: 22, padding: 22, marginBottom: 14 }}>
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
            { label: 'ตั๋วใช้งาน', value: `${activePawns} ใบ`, href: '/pawns?filter=active' },
            { label: 'เงินกู้คงอยู่', value: `${activeLoans} ราย`, href: '/loans' },
            { label: 'ผลตอบแทนต่อปี', value: `${roi}%`, href: '/report' },
          ].map((item) => (
            <div
              key={item.label}
              onClick={() => router.push(item.href)}
              style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: '12px 8px', textAlign: 'center', cursor: 'pointer' }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>{item.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section-label">ห่านทองคำ</div>
      <div className="card home-action-card" style={{ marginBottom: 14, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
          <span className={pendingCount > 0 ? 'badge-pending home-status-pill' : 'home-status-pill'} data-busy={pendingCount > 0}>
            {pendingCount > 0 ? `${pendingCount} งานค้าง` : 'พร้อมทำงาน'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <button className="btn-primary" onClick={() => router.push('/pawn/new')} style={{ fontSize: 15, padding: '16px 12px', minHeight: 60 }}>
            🪺 รับฝากห่าน
          </button>
          <button className="btn-secondary" onClick={() => router.push('/pawns')} style={{ fontSize: 15, padding: '16px 12px', minHeight: 60, background: 'rgba(255,255,255,0.02)' }}>
            🔍 ค้นหา / ดูฝูงห่าน
          </button>
        </div>

      </div>

      <div className="section-label">สวนผลไม้</div>
      <div className="card" style={{ marginBottom: 14, padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button className="btn-primary" onClick={() => router.push('/loans/new')} style={{ fontSize: 15, padding: '16px 12px' }}>
            🌱 ปลูกต้นไม้เพิ่ม
          </button>
          <button className="btn-secondary" onClick={() => router.push('/loans')} style={{ fontSize: 15, padding: '16px 12px' }}>
            🍊 ชมสวนผลไม้
          </button>
        </div>
      </div>

      <div className="section-label">ผลผลิต</div>
      <div className="card" style={{ marginBottom: 14, padding: 16 }}>
        <button className="btn-secondary" onClick={() => router.push('/report')} style={{ fontSize: 15, padding: '16px 12px', width: '100%' }}>
          📊 ดูผลผลิต
        </button>
      </div>

      <BottomNav />
    </main>
  )
}
