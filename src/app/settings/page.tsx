'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession, clearSession, canAccessSettings } from '@/lib/auth'

export default function Settings() {
  const router = useRouter()
  const [budget, setBudget] = useState('')
  const [newPin, setNewPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingPin, setSavingPin] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedPin, setSavedPin] = useState(false)
  const user = getSession()

  useEffect(() => {
    if (!canAccessSettings(user)) {
      router.replace('/')
      return
    }
    supabase.from('settings').select('*').single().then(({ data }) => {
      if (data) setBudget(data.invest_budget.toString())
    })
  }, [])

  async function handleSaveBudget() {
    setSaving(true)
    await supabase.from('settings')
      .update({ invest_budget: parseFloat(budget), updated_at: new Date().toISOString() })
      .neq('id', '00000000-0000-0000-0000-000000000000')
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleSavePin() {
    if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
      alert('PIN ต้องเป็นตัวเลข 6 หลัก')
      return
    }
    setSavingPin(true)
    await supabase.from('settings')
      .update({ agent_pin: newPin })
      .neq('id', '00000000-0000-0000-0000-000000000000')
    setSavingPin(false)
    setSavedPin(true)
    setNewPin('')
    setTimeout(() => setSavedPin(false), 2000)
  }

  function handleLogout() {
    clearSession()
    router.replace('/login')
  }

  return (
    <main className="page-container">
      <div style={{ padding: '56px 0 24px' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gold)' }}>ตั้งค่า</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
          เข้าสู่ระบบในฐานะ: <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{user?.display_name}</span>
        </div>
      </div>

      {/* วงเงินลงทุน */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>💰 วงเงินลงทุนทั้งหมด</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>จำนวนเงิน (บาท)</div>
        <input className="input-field" type="number" placeholder="เช่น 700000"
          value={budget} onChange={e => setBudget(e.target.value)} style={{ marginBottom: 16 }} />
        <button className="btn-primary" onClick={handleSaveBudget} disabled={saving} style={{ fontSize: 16 }}>
          {saved ? '✓ บันทึกแล้ว' : saving ? 'กำลังบันทึก...' : 'บันทึกวงเงิน'}
        </button>
      </div>

      {/* ตั้ง PIN แม่ */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>🔐 PIN สำหรับแม่</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>ตั้ง PIN 6 หลักสำหรับให้แม่ login</div>
        <input className="input-field" type="number" placeholder="ตัวเลข 6 หลัก"
          value={newPin} onChange={e => setNewPin(e.target.value.slice(0, 6))}
          style={{ marginBottom: 16 }} />
        <button className="btn-primary" onClick={handleSavePin} disabled={savingPin} style={{ fontSize: 16 }}>
          {savedPin ? '✓ ตั้ง PIN แล้ว' : savingPin ? 'กำลังบันทึก...' : 'ตั้ง PIN แม่'}
        </button>
      </div>

      {/* เกี่ยวกับ */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>🪿 เกี่ยวกับแอป</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <div>ห่านทองคำ v1.0</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>ระบบดูแลการลงทุนรับจำนำทอง</div>
        </div>
      </div>

      {/* Logout */}
      <button onClick={handleLogout} style={{ width: '100%', padding: '16px', borderRadius: 16, border: '1px solid rgba(240,149,149,0.3)', background: 'transparent', color: '#f09595', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
        ออกจากระบบ
      </button>

      
            <nav className="bottom-nav">
        {[
          { icon: '🪿', label: 'หน้าแรก', href: '/' },
          { icon: '📋', label: 'ฝูงห่าน', href: '/pawns' },
          { icon: '🍊', label: 'สวนส้ม', href: '/loans' },
          { icon: '📊', label: 'ผลผลิต', href: '/settings', active: true },
        ].map(n => (
          <a key={n.label} href={n.href} className={`nav-item ${n.active ? 'active' : ''}`}>
            <span className="nav-icon">{n.icon}</span>{n.label}
          </a>
        ))}
      </nav>
      <div style={{ height: 32 }} />
    </main>
  )
}
