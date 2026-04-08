'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const [budget, setBudget] = useState(0)
  const [activePawns, setActivePawns] = useState(0)
  const [activeAmount, setActiveAmount] = useState(0)
  const [monthInterest, setMonthInterest] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      const { data: settings } = await supabase
        .from('settings').select('*').single()
      if (settings) setBudget(settings.invest_budget)

      const { data: pawns } = await supabase
        .from('pawns').select('*').eq('status', 'active')
      if (pawns) {
        setActivePawns(pawns.length)
        setActiveAmount(pawns.reduce((s, p) => s + p.amount, 0))
      }

      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString().split('T')[0]
      const { data: interests } = await supabase
        .from('interest_payments')
        .select('amount')
        .gte('payment_date', firstDay)
      if (interests)
        setMonthInterest(interests.reduce((s, i) => s + i.amount, 0))
    } finally {
      setLoading(false)
    }
  }

  const remaining = budget - activeAmount
  const usedPct = budget > 0 ? Math.round((activeAmount / budget) * 100) : 0

  function fmt(n: number) {
    return n.toLocaleString('th-TH')
  }

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100dvh', color: 'var(--gold)', fontSize: 14
    }}>
      กำลังโหลด...
    </div>
  )

  return (
    <main className="page-container">
      {/* Header */}
      <div style={{ padding: '52px 0 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--gold)' }}>ทองจำนำ</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'linear-gradient(135deg,#C9922A,#E8C55A)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 700, color: '#030F08'
        }}>ท</div>
      </div>

      {/* Hero Card */}
      <div style={{
        background: 'linear-gradient(135deg,#0A2A15,#0F3D1E)',
        border: '0.5px solid rgba(232,197,90,0.2)',
        borderRadius: 20, padding: 20, marginBottom: 16
      }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>วงเงินลงทุนคงเหลือ</div>
        <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--gold)', letterSpacing: -1 }}>
          ฿{fmt(remaining)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
          จากทั้งหมด ฿{fmt(budget)}
        </div>

        {/* Progress bar */}
        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 99, height: 6, marginBottom: 14 }}>
          <div style={{
            background: 'linear-gradient(90deg,#C9922A,#E8C55A)',
            borderRadius: 99, height: 6,
            width: `${Math.min(usedPct, 100)}%`,
            transition: 'width 0.5s'
          }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'ตั๋วจำนำ', value: `${activePawns} ใบ` },
            { label: 'ยอดปล่อยกู้', value: `฿${fmt(activeAmount)}` },
            { label: 'ดอกเดือนนี้', value: `฿${fmt(monthInterest)}` },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,0.07)',
              borderRadius: 12, padding: '10px 8px', textAlign: 'center'
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
        <a href="/pawn/new" className="btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>📥</span> จำนำ
        </a>
        <a href="/redeem" className="btn-secondary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>📤</span> ไถ่ถอน
        </a>
      </div>

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        {[
          { icon: '⬛', label: 'หน้าแรก', href: '/', active: true },
          { icon: '⬛', label: 'รายการ', href: '/pawns', active: false },
          { icon: '⬛', label: 'รายงาน', href: '/report', active: false },
          { icon: '⬛', label: 'ตั้งค่า', href: '/settings', active: false },
        ].map(n => (
          <a key={n.label} href={n.href}
            className={`nav-item ${n.active ? 'active' : ''}`}
            style={{ textDecoration: 'none' }}>
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </a>
        ))}
      </nav>
    </main>
  )
}