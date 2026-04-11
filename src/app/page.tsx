'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { fmt } from '@/lib/utils'
import NotificationBell from '@/components/NotificationBell'

export default function Dashboard() {
  const router = useRouter()
  const user = getSession()
  const [budget, setBudget] = useState(0)
  const [activePawns, setActivePawns] = useState(0)
  const [activeAmount, setActiveAmount] = useState(0)
  const [activeLoans, setActiveLoans] = useState(0)
  const [loanAmount, setLoanAmount] = useState(0)
  const [monthInterest, setMonthInterest] = useState(0)
  const [monthCount, setMonthCount] = useState(0)
  const [pendingPawns, setPendingPawns] = useState<any[]>([])
  const [pendingRedeems, setPendingRedeems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    try {
      const { data: settings } = await supabase.from('settings').select('*').single()
      if (settings) setBudget(settings.invest_budget)

      const { data: pawns } = await supabase.from('pawns').select('*').eq('status', 'active')
      if (pawns) {
        setActivePawns(pawns.filter(p => p.tx_status === 'active').length)
        setActiveAmount(pawns.filter(p => p.tx_status === 'active').reduce((s, p) => s + p.amount, 0))
        setPendingPawns(pawns.filter(p => p.tx_status === 'pending_transfer'))
      }

      const { data: pendingR } = await supabase.from('redemptions').select('*, pawns(ticket_no, amount)').eq('status', 'pending_confirm')
      if (pendingR) setPendingRedeems(pendingR)

      const { data: loans } = await supabase.from('loans').select('*').eq('status', 'active')
      if (loans) {
        setActiveLoans(loans.length)
        setLoanAmount(loans.reduce((s, l) => s + l.remaining_principal, 0))
      }

      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const { data: interests } = await supabase.from('interest_payments').select('amount').gte('payment_date', firstDay)
      const { data: redemptions } = await supabase.from('redemptions').select('interest_last').gte('redeem_date', firstDay)
      const { data: loanTxns } = await supabase.from('loan_transactions').select('amount').eq('type', 'interest').gte('transaction_date', firstDay)

      let totalInterest = 0, count = 0
      if (interests) { totalInterest += interests.reduce((s, i) => s + i.amount, 0); count += interests.length }
      if (redemptions) { totalInterest += redemptions.reduce((s, r) => s + (r.interest_last || 0), 0); count += redemptions.length }
      if (loanTxns) { totalInterest += loanTxns.reduce((s, t) => s + t.amount, 0); count += loanTxns.length }
      setMonthInterest(totalInterest)
      setMonthCount(count)
    } finally {
      setLoading(false)
    }
  }

  const totalInvested = activeAmount + loanAmount
  const remaining = budget - totalInvested
  const usedPct = budget > 0 ? Math.round((totalInvested / budget) * 100) : 0
  const roi = budget > 0 ? ((monthInterest / budget) * 12 * 100).toFixed(1) : '0.0'
  const isOwner = user?.role === 'owner'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--gold)', fontSize: 18 }}>
      กำลังโหลด...
    </div>
  )

  return (
    <main className="page-container">
      <div style={{ padding: '56px 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 32 }}>🪿</span>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--gold)', letterSpacing: -0.5 }}>ห่านทองคำ</div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            สวัสดี {user?.role === 'owner' ? '🌾 ชาวสวน' : '🪿 เจ้หลุย'} · {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NotificationBell pendingPawns={pendingPawns} pendingRedeems={pendingRedeems} />
          <button onClick={() => router.push('/settings')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 26 }}>⚙️</button>
        </div>
      </div>

      {/* Hero Card */}
      <div style={{ background: 'linear-gradient(135deg,#180F00,#2C1A00)', border: '1px solid rgba(242,201,76,0.35)', borderRadius: 22, padding: 22, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>🌾 ข้าวบาร์เลย์คงเหลือ</div>
        <div style={{ fontSize: 38, fontWeight: 800, color: 'var(--gold)', letterSpacing: -1, marginBottom: 2 }}>฿{fmt(remaining)}</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>จากทั้งหมด ฿{fmt(budget)}</div>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 99, height: 8, marginBottom: 18 }}>
          <div style={{ background: 'linear-gradient(90deg,#C9922A,#F2C94C)', borderRadius: 99, height: 8, width: `${Math.min(usedPct, 100)}%`, transition: 'width 0.5s' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'ห่านทองคำ', value: `${activePawns} ตัว`, href: '/pawns' },
            { label: 'ต้นส้ม', value: `${activeLoans} ต้น`, href: '/loans' },
            { label: 'ผลผลิต/ปี', value: `${roi}%`, href: '/report' },
          ].map(s => (
            <div key={s.label} onClick={() => router.push(s.href)}
              style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: '12px 8px', textAlign: 'center', cursor: 'pointer' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ไข่เดือนนี้ */}
      <div onClick={() => router.push('/report')} className="card" style={{ marginBottom: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>🥚 ไข่เดือนนี้</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--gold)' }}>฿{fmt(monthInterest)}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{monthCount} รายการ</div>
        </div>
        <div style={{ fontSize: 32, color: 'var(--text-muted)' }}>›</div>
      </div>

      {/* เมนู ห่านทองคำ */}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>🪿 ห่านทองคำ</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <button className="btn-primary" onClick={() => router.push('/pawn/new')} style={{ fontSize: 15, padding: '16px 12px' }}>🪺 รับฝากห่าน</button>
        <button className="btn-secondary" onClick={() => router.push('/redeem')} style={{ fontSize: 15, padding: '16px 12px' }}>🐣 คืนห่าน</button>
        <button className="btn-secondary" onClick={() => router.push('/interest')} style={{ fontSize: 15, padding: '16px 12px' }}>🥚 เก็บไข่</button>
        <button className="btn-secondary" onClick={() => router.push('/pawns')} style={{ fontSize: 15, padding: '16px 12px' }}>📋 ดูฝูงห่าน</button>
      </div>

      {/* เมนู ทุ่งนา */}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>🌾 ทุ่งนา</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <button className="btn-primary" onClick={() => router.push('/loans/new')} style={{ fontSize: 15, padding: '16px 12px' }}>🌱 ปลูกต้นส้มใหม่</button>
        <button className="btn-secondary" onClick={() => router.push('/loans')} style={{ fontSize: 15, padding: '16px 12px' }}>🍊 ดูสวนส้ม</button>
      </div>

      {/* เมนู อื่นๆ */}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>อื่นๆ</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <button className="btn-secondary" onClick={() => router.push('/other-income')} style={{ fontSize: 15, padding: '16px 12px' }}>🌾 เกี่ยวข้าว</button>
        <button className="btn-secondary" onClick={() => router.push('/report')} style={{ fontSize: 15, padding: '16px 12px' }}>📊 ผลผลิต</button>
      </div>

      
    </main>
  )
}
