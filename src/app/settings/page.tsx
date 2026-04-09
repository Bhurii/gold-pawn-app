'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Settings() {
  const [budget, setBudget] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.from('settings').select('*').single().then(({ data }) => {
      if (data) setBudget(data.invest_budget.toString())
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    await supabase.from('settings')
      .update({ invest_budget: parseFloat(budget), updated_at: new Date().toISOString() })
      .neq('id', '00000000-0000-0000-0000-000000000000')
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <main className="page-container">
      <div style={{ padding: '52px 0 24px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>ตั้งค่า</div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 16 }}>วงเงินลงทุนทั้งหมด</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>จำนวนเงิน (บาท)</div>
        <input className="input-field" type="number" placeholder="เช่น 700000" value={budget} onChange={e => setBudget(e.target.value)} style={{ marginBottom: 16 }} />
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saved ? '✓ บันทึกแล้ว' : saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>เกี่ยวกับแอป</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <div>ทองจำนำ v1.0</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>ระบบดูแลการลงทุนรับจำนำทอง</div>
        </div>
      </div>
      <nav className="bottom-nav">
        {[
          { label: 'หน้าแรก', href: '/' },
          { label: 'รายการ', href: '/pawns' },
          { label: 'รายงาน', href: '/report' },
          { label: 'ตั้งค่า', href: '/settings', active: true },
        ].map(n => (
          <a key={n.label} href={n.href} className={`nav-item ${n.active ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
            <span className="nav-icon">⬛</span>{n.label}
          </a>
        ))}
      </nav>
    </main>
  )
}
