'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const router = useRouter()
  const [budget, setBudget] = useState(0)
  const [activePawns, setActivePawns] = useState(0)
  const [activeAmount, setActiveAmount] = useState(0)
  const [monthInterest, setMonthInterest] = useState(0)
  const [monthCount, setMonthCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    try {
      const { data: settings } = await supabase.from('settings').select('*').single()
      if (settings) setBudget(settings.invest_budget)

      const { data: pawns } = await supabase.from('pawns').select('*').eq('status', 'active')
      if (pawns) {
        setActivePawns(pawns.length)
        setActiveAmount(pawns.reduce((s, p) => s + p.amount, 0))
      }

      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const { data: interests } = await supabase.from('interest_payments').select('amount').gte('payment_date', firstDay)
      const { data: redemptions } = await supabase.from('redemptions').select('interest_last, interest_total').gte('redeem_date', firstDay)

      let totalInterest = 0
      let count = 0
      if (interests) { totalInterest += interests.reduce((s, i) => s + i.amount, 0); count += interests.length }
      if (redemptions) { totalInterest += redemptions.reduce((s, r) => s + r.interest_last, 0); count += redemptions.length }
      setMonthInterest(totalInterest)
      setMonthCount(count)
    } finally {
      setLoading(false)
    }
  }

  const remaining = budget - activeAmount
  const usedPct = budget > 0 ? Math.round((activeAmount / budget) * 100) : 0
  const roi = budget > 0 ? ((monthInterest / budget) * 12 * 100).toFixed(1) : '0.0'

  function fmt(n: number) { return n.toLocaleString('th-TH') }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--gold)', fontSize: 18 }}>
      กำลังโหลด...
    </div>
  )

  return (
    <main className="page-container">
      <div style={{ padding: '56px 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)', letterSpacing: -0.5 }}>ทองจำนำ</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>
            {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#B8860B,#F0C040)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#0A0A0A' }}>ท</div>
      </div>

      {/* Hero Card */}
      <div style={{ background: 'linear-gradient(135deg,#1A1200,#2A1F00)', border: '1px solid rgba(240,192,64,0.3)', borderRadius: 22, padding: 22, marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>วงเงินลงทุนคงเหลือ</div>
        <div style={{ fontSize: 38, fontWeight: 800, color: 'var(--gold)', letterSpacing: -1, marginBottom: 2 }}>฿{fmt(remaining)}</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>จากทั้งหมด ฿{fmt(budget)}</div>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 99, height: 8, marginBottom: 18 }}>
          <div style={{ background: 'linear-gradient(90deg,#B8860B,#F0C040)', borderRadius: 99, height: 8, width: `${Math.min(usedPct, 100)}%`, transition: 'width 0.5s' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'ตั๋วจำนำ', value: `${activePawns} ใบ`, href: '/pawns' },
            { label: 'ยอดปล่อยกู้', value: `฿${fmt(activeAmount)}`, href: '/pawns' },
            { label: 'ROI/ปี', value: `${roi}%`, href: '/report' },
          ].map(s => (
            <div key={s.label} onClick={() => router.push(s.href)}
              style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: '12px 8px', textAlign: 'center', cursor: 'pointer' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ดอกเบี้ยเดือนนี้ */}
      <div onClick={() => router.push('/report')} className="card" style={{ marginBottom: 16, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>ดอกเบี้ยเดือนนี้</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)' }}>฿{fmt(monthInterest)}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{monthCount} รายการ</div>
        </div>
        <div style={{ fontSize: 28, color: 'var(--text-muted)' }}>›</div>
      </div>

      {/* ปุ่มหลัก */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <button className="btn-primary" onClick={() => router.push('/pawn/new')} style={{ fontSize: 18, padding: '18px 12px' }}>
          📥 จำนำ
        </button>
        <button className="btn-secondary" onClick={() => router.push('/redeem')} style={{ fontSize: 18, padding: '18px 12px' }}>
          📤 ไถ่ถอน
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <button className="btn-secondary" onClick={() => router.push('/interest')} style={{ fontSize: 16, padding: '16px 12px' }}>
          ✂️ ตัดดอก
        </button>
        <button className="btn-secondary" onClick={() => router.push('/pawns')} style={{ fontSize: 16, padding: '16px 12px' }}>
          📋 รายการ
        </button>
      </div>

      <nav className="bottom-nav">
        {[
          { icon: '🏠', label: 'หน้าแรก', href: '/', active: true },
          { icon: '📋', label: 'รายการ', href: '/pawns' },
          { icon: '📊', label: 'รายงาน', href: '/report' },
          { icon: '⚙️', label: 'ตั้งค่า', href: '/settings' },
        ].map(n => (
          <a key={n.label} href={n.href} className={`nav-item ${n.active ? 'active' : ''}`}>
            <span className="nav-icon">{n.icon}</span>{n.label}
          </a>
        ))}
      </nav>
    </main>
  )
}
