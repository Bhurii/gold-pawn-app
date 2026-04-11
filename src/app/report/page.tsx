'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Report() {
  const router = useRouter()
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [data, setData] = useState({ interest: 0, count: 0, budget: 0, pawned: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadReport() }, [selectedMonth, selectedYear])

  async function loadReport() {
    setLoading(true)
    const firstDay = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0]
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0]

    const { data: settings } = await supabase.from('settings').select('invest_budget').single()
    const { data: interests } = await supabase.from('interest_payments').select('amount').gte('payment_date', firstDay).lte('payment_date', lastDay)
    const { data: redemptions } = await supabase.from('redemptions').select('interest_last').gte('redeem_date', firstDay).lte('redeem_date', lastDay)
    const { data: pawns } = await supabase.from('pawns').select('amount').eq('status', 'active')

    const budget = settings?.invest_budget || 0
    const pawned = pawns?.reduce((s, p) => s + p.amount, 0) || 0
    let interest = 0
    let count = 0
    if (interests) { interest += interests.reduce((s, i) => s + i.amount, 0); count += interests.length }
    if (redemptions) { interest += redemptions.reduce((s, r) => s + r.interest_last, 0); count += redemptions.length }

    setData({ interest, count, budget, pawned })
    setLoading(false)
  }

  const fmt = (n: number) => n.toLocaleString('th-TH')
  const roiMonthly = data.budget > 0 ? ((data.interest / data.budget) * 100).toFixed(2) : '0.00'
  const roiAnnual = data.budget > 0 ? ((data.interest / data.budget) * 12 * 100).toFixed(1) : '0.0'

  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

  return (
    <main className="page-container">
      <div style={{ padding: '56px 0 16px' }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--gold)' }}>รายงาน</div>
      </div>

      {/* เลือกเดือน */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
          className="input-field" style={{ flex: 2 }}>
          {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
          className="input-field" style={{ flex: 1 }}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y + 543}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--gold)', padding: 40, fontSize: 18 }}>กำลังโหลด...</div>
      ) : (
        <>
          {/* การ์ดหลัก */}
          <div style={{ background: 'linear-gradient(135deg,#1A1200,#2A1F00)', border: '1px solid rgba(240,192,64,0.3)', borderRadius: 20, padding: 22, marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>ดอกเบี้ยที่ได้รับ</div>
            <div style={{ fontSize: 38, fontWeight: 800, color: 'var(--gold)', marginBottom: 4 }}>฿{fmt(data.interest)}</div>
            <div style={{ fontSize: 15, color: 'var(--text-secondary)' }}>{data.count} รายการ</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>ROI เดือนนี้</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)' }}>{roiMonthly}%</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>ROI ต่อปี</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)' }}>{roiAnnual}%</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>วงเงินลงทุน</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>฿{fmt(data.budget)}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>ยอดปล่อยกู้</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>฿{fmt(data.pawned)}</div>
            </div>
          </div>
        </>
      )}

      
          <nav className="bottom-nav">
        <a href="/" className="nav-item"><span className="nav-icon">🪿</span>หน้าแรก</a>
        <a href="/pawns" className="nav-item"><span className="nav-icon">📋</span>ฝูงห่าน</a>
        <a href="/loans" className="nav-item"><span className="nav-icon">🍊</span>สวนส้ม</a>
        <a href="/report" className="nav-item active"><span className="nav-icon">📊</span>ผลผลิต</a>
      </nav>
    </main>
  )
}
