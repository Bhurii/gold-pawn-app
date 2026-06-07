'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ToastProvider'
import { canAccessSettings, clearSession, getOwnerPinValue, getSession, isAdmin, saveOwnerPin } from '@/lib/auth'
import BottomNav from '@/components/BottomNav'
import PushToggleCard from '@/components/PushToggleCard'

export default function Settings() {
  const router = useRouter()
  const { showToast } = useToast()
  const user = getSession()
  const admin = isAdmin(user)
  const [budget, setBudget] = useState('')
  const [ownerPin, setOwnerPin] = useState('')
  const [agentPin, setAgentPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingOwnerPin, setSavingOwnerPin] = useState(false)
  const [savingAgentPin, setSavingAgentPin] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedOwnerPin, setSavedOwnerPin] = useState(false)
  const [savedAgentPin, setSavedAgentPin] = useState(false)

  useEffect(() => {
    if (!canAccessSettings(user)) {
      router.replace('/')
      return
    }

    void loadSettings()
  }, [router, user])

  async function loadSettings() {
    const [{ data }, currentOwnerPin] = await Promise.all([
      supabase.from('settings').select('invest_budget, agent_pin').single(),
      admin ? getOwnerPinValue() : Promise.resolve(''),
    ])

    if (data) {
      setBudget(data.invest_budget?.toString() || '')
      setAgentPin(data.agent_pin || '')
    }
    setOwnerPin(currentOwnerPin)
  }

  async function handleSaveBudget() {
    setSaving(true)
    await supabase.from('settings')
      .update({ invest_budget: parseFloat(budget), updated_at: new Date().toISOString() })
      .neq('id', '00000000-0000-0000-0000-000000000000')
    setSaving(false)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  async function handleSaveOwnerPin() {
    if (ownerPin.length !== 6 || !/^\d+$/.test(ownerPin)) {
      showToast({ tone: 'error', title: 'PIN ไม่ถูกต้อง', message: 'PIN โทนี่ต้องเป็นตัวเลข 6 หลัก' })
      return
    }

    setSavingOwnerPin(true)
    try {
      await saveOwnerPin(ownerPin)
      setSavedOwnerPin(true)
      window.setTimeout(() => setSavedOwnerPin(false), 2000)
    } catch {
      showToast({ tone: 'error', title: 'บันทึกไม่สำเร็จ', message: 'บันทึก PIN โทนี่ไม่สำเร็จ' })
    } finally {
      setSavingOwnerPin(false)
    }
  }

  async function handleSaveAgentPin() {
    if (agentPin.length !== 6 || !/^\d+$/.test(agentPin)) {
      showToast({ tone: 'error', title: 'PIN ไม่ถูกต้อง', message: 'PIN เจ้หลุยส์ต้องเป็นตัวเลข 6 หลัก' })
      return
    }

    setSavingAgentPin(true)
    await supabase.from('settings').update({ agent_pin: agentPin }).neq('id', '00000000-0000-0000-0000-000000000000')
    setSavingAgentPin(false)
    setSavedAgentPin(true)
    window.setTimeout(() => setSavedAgentPin(false), 2000)
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
          เข้าในระบบเป็น: <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{admin ? 'โทนี่ (แอดมิน)' : 'เจ้หลุยส์'}</span>
        </div>
      </div>

      {admin && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>วงเงินลงทุนทั้งหมด</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>จำนวนเงิน (บาท)</div>
          <input className="input-field" type="number" placeholder="เช่น 700000" value={budget} onChange={(event) => setBudget(event.target.value)} style={{ marginBottom: 16 }} />
          <button className="btn-primary" onClick={() => void handleSaveBudget()} disabled={saving} style={{ fontSize: 16 }}>
            {saved ? 'บันทึกแล้ว' : saving ? 'กำลังบันทึก...' : 'บันทึกวงเงิน'}
          </button>
        </div>
      )}

      {admin && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>PIN โทนี่</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>ตั้ง PIN 6 หลักสำหรับเข้าแอปในฐานะแอดมิน</div>
          <input className="input-field" type="number" placeholder="ตัวเลข 6 หลัก" value={ownerPin} onChange={(event) => setOwnerPin(event.target.value.slice(0, 6))} style={{ marginBottom: 16 }} />
          <button className="btn-primary" onClick={() => void handleSaveOwnerPin()} disabled={savingOwnerPin} style={{ fontSize: 16 }}>
            {savedOwnerPin ? 'ตั้ง PIN โทนี่แล้ว' : savingOwnerPin ? 'กำลังบันทึก...' : 'ตั้ง PIN โทนี่'}
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>PIN เจ้หลุยส์</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          {admin ? 'ตั้ง PIN 6 หลักสำหรับให้เจ้หลุยส์เข้าใช้งาน' : 'เปลี่ยน PIN 6 หลักของเจ้หลุยส์บนเครื่องนี้'}
        </div>
        <input className="input-field" type="number" placeholder="ตัวเลข 6 หลัก" value={agentPin} onChange={(event) => setAgentPin(event.target.value.slice(0, 6))} style={{ marginBottom: 16 }} />
        <button className="btn-primary" onClick={() => void handleSaveAgentPin()} disabled={savingAgentPin} style={{ fontSize: 16 }}>
          {savedAgentPin ? 'บันทึก PIN แล้ว' : savingAgentPin ? 'กำลังบันทึก...' : admin ? 'ตั้ง PIN เจ้หลุยส์' : 'บันทึก PIN ของฉัน'}
        </button>
      </div>

      <PushToggleCard />

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>เกี่ยวกับแอป</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <div>ห่านทองคำ v1.0</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>ระบบดูแลการลงทุนรับจำนำทอง</div>
        </div>
      </div>

      <button onClick={handleLogout} className="danger-chip" style={{ width: '100%', padding: '16px', borderRadius: 16, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 16 }}>
        ออกจากระบบ
      </button>

      <BottomNav />
      <div style={{ height: 32 }} />
    </main>
  )
}
