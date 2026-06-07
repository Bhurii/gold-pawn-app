'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession, clearSession, canAccessSettings } from '@/lib/auth'
import PushPrompt from '@/components/PushPrompt'

export default function Settings() {
  const router = useRouter()
  const [budget, setBudget] = useState('')
  const [ownerPin, setOwnerPin] = useState('')
  const [agentPin, setAgentPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingOwnerPin, setSavingOwnerPin] = useState(false)
  const [savingAgentPin, setSavingAgentPin] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedOwnerPin, setSavedOwnerPin] = useState(false)
  const [savedAgentPin, setSavedAgentPin] = useState(false)
  const user = getSession()

  useEffect(() => {
    if (!canAccessSettings(user)) {
      router.replace('/')
      return
    }
    supabase.from('settings').select('*').single().then(({ data }) => {
      if (data) {
        setBudget(data.invest_budget?.toString() || '')
        setOwnerPin(data.owner_pin || '')
        setAgentPin(data.agent_pin || '')
      }
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

  async function handleSaveOwnerPin() {
    if (ownerPin.length !== 6 || !/^\d+$/.test(ownerPin)) {
      alert('PIN เจ้าของต้องเป็นตัวเลข 6 หลัก')
      return
    }
    setSavingOwnerPin(true)
    await supabase.from('settings')
      .update({ owner_pin: ownerPin })
      .neq('id', '00000000-0000-0000-0000-000000000000')
    setSavingOwnerPin(false)
    setSavedOwnerPin(true)
    setTimeout(() => setSavedOwnerPin(false), 2000)
  }

  async function handleSaveAgentPin() {
    if (agentPin.length !== 6 || !/^\d+$/.test(agentPin)) {
      alert('PIN แม่ต้องเป็นตัวเลข 6 หลัก')
      return
    }
    setSavingAgentPin(true)
    await supabase.from('settings')
      .update({ agent_pin: agentPin })
      .neq('id', '00000000-0000-0000-0000-000000000000')
    setSavingAgentPin(false)
    setSavedAgentPin(true)
    setTimeout(() => setSavedAgentPin(false), 2000)
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
          เข้าในระบบเป็น: <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{user?.display_name}</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>💰 วงเงินลงทุนทั้งหมด</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>จำนวนเงิน (บาท)</div>
        <input
          className="input-field"
          type="number"
          placeholder="เช่น 700000"
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
          style={{ marginBottom: 16 }}
        />
        <button className="btn-primary" onClick={handleSaveBudget} disabled={saving} style={{ fontSize: 16 }}>
          {saved ? '✓ บันทึกแล้ว' : saving ? 'กำลังบันทึก...' : 'บันทึกวงเงิน'}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>👑 PIN เจ้าของ</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>ตั้ง PIN 6 หลักสำหรับเข้าแอปในฐานะเจ้าของ</div>
        <input
          className="input-field"
          type="number"
          placeholder="ตัวเลข 6 หลัก"
          value={ownerPin}
          onChange={(event) => setOwnerPin(event.target.value.slice(0, 6))}
          style={{ marginBottom: 16 }}
        />
        <button className="btn-primary" onClick={handleSaveOwnerPin} disabled={savingOwnerPin} style={{ fontSize: 16 }}>
          {savedOwnerPin ? '✓ ตั้ง PIN เจ้าของแล้ว' : savingOwnerPin ? 'กำลังบันทึก...' : 'ตั้ง PIN เจ้าของ'}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>🔐 PIN สำหรับแม่</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>ตั้ง PIN 6 หลักสำหรับให้แม่ login</div>
        <input
          className="input-field"
          type="number"
          placeholder="ตัวเลข 6 หลัก"
          value={agentPin}
          onChange={(event) => setAgentPin(event.target.value.slice(0, 6))}
          style={{ marginBottom: 16 }}
        />
        <button className="btn-primary" onClick={handleSaveAgentPin} disabled={savingAgentPin} style={{ fontSize: 16 }}>
          {savedAgentPin ? '✓ ตั้ง PIN แม่แล้ว' : savingAgentPin ? 'กำลังบันทึก...' : 'ตั้ง PIN แม่'}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>🪿 เกี่ยวกับแอป</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <div>ห่านทองคำ v1.0</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>ระบบดูแลการลงทุนรับจำนำทอง</div>
        </div>
      </div>

      <PushPrompt />

      <button onClick={handleLogout} className="danger-chip" style={{ width: '100%', padding: '16px', borderRadius: 16, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
        ออกจากระบบ
      </button>

      <nav className="bottom-nav">
        <a href="/" className="nav-item"><span className="nav-icon">🪿</span>หน้าแรก</a>
        <a href="/pawns" className="nav-item"><span className="nav-icon">📋</span>ฝูงห่าน</a>
        <a href="/loans" className="nav-item"><span className="nav-icon">🍊</span>สวนผลไม้</a>
        <a href="/report" className="nav-item active"><span className="nav-icon">📊</span>ผลผลิต</a>
      </nav>
      <div style={{ height: 32 }} />
    </main>
  )
}
