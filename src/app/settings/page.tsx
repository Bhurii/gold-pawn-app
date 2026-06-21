'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ToastProvider'
import { canAccessSettings, clearSession, fetchSession, getSession, isAdmin, type AppUser } from '@/lib/auth'
import BottomNav from '@/components/BottomNav'
import PushToggleCard from '@/components/PushToggleCard'

type SettingsPayload = {
  role: 'owner' | 'agent'
  isAdmin: boolean
  budget: number | null
  hasOwnerPin: boolean
  hasAgentPin: boolean
}

type SettingsCache = {
  user: AppUser | null
  settings: SettingsPayload | null
  budget: string
}

export default function Settings() {
  const router = useRouter()
  const { showToast } = useToast()
  const [user, setUser] = useState<AppUser | null>(() => getSession())
  const [settings, setSettings] = useState<SettingsPayload | null>(null)
  const [budget, setBudget] = useState('')
  const [ownerPin, setOwnerPin] = useState('')
  const [agentPin, setAgentPin] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingOwnerPin, setSavingOwnerPin] = useState(false)
  const [savingAgentPin, setSavingAgentPin] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedOwnerPin, setSavedOwnerPin] = useState(false)
  const [savedAgentPin, setSavedAgentPin] = useState(false)

  const admin = useMemo(() => isAdmin(user), [user])

  useEffect(() => {
    let active = true

    async function boot() {
      const session = await fetchSession()
      if (!active) return

      if (!canAccessSettings(session)) {
        router.replace('/')
        return
      }

      hydrateFromCache()
      setUser(session)
      await loadSettings()
    }

    void boot()

    return () => {
      active = false
    }
  }, [router])

  function hydrateFromCache() {
    if (typeof window === 'undefined') return

    try {
      const raw = window.sessionStorage.getItem('settings:app')
      if (!raw) return
      const cached = JSON.parse(raw) as SettingsCache
      setUser(cached.user || getSession())
      setSettings(cached.settings || null)
      setBudget(cached.budget || '')
      setLoading(false)
    } catch {
      // Ignore invalid cache and refetch.
    }
  }

  async function loadSettings() {
    setLoading((current) => (settings ? current : true))
    try {
      const response = await fetch('/api/settings/app', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'โหลดข้อมูลตั้งค่าไม่สำเร็จ')
      }

      const nextSettings = payload as SettingsPayload
      setSettings(nextSettings)
      setBudget(nextSettings.budget?.toString() || '')
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('settings:app', JSON.stringify({
          user: getSession(),
          settings: nextSettings,
          budget: nextSettings.budget?.toString() || '',
        } satisfies SettingsCache))
      }
    } catch (error) {
      showToast({ tone: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', message: error instanceof Error ? error.message : 'ลองเข้าใหม่อีกครั้ง' })
    } finally {
      setLoading(false)
    }
  }

  async function updateSettings(patch: Record<string, unknown>) {
    const response = await fetch('/api/settings/app', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(typeof payload?.error === 'string' ? payload.error : 'บันทึกไม่สำเร็จ')
    }

    await loadSettings()
  }

  async function handleSaveBudget() {
    const parsed = Number(budget)
    if (!Number.isFinite(parsed) || parsed < 0) {
      showToast({ tone: 'error', title: 'วงเงินไม่ถูกต้อง', message: 'ใส่วงเงินเป็นตัวเลข 0 หรือมากกว่า' })
      return
    }

    setSaving(true)
    try {
      await updateSettings({ budget: parsed })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      showToast({ tone: 'error', title: 'บันทึกไม่สำเร็จ', message: error instanceof Error ? error.message : 'บันทึกวงเงินไม่สำเร็จ' })
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveOwnerPin() {
    if (ownerPin.length !== 6 || !/^\d+$/.test(ownerPin)) {
      showToast({ tone: 'error', title: 'PIN ไม่ถูกต้อง', message: 'PIN โทนี่ต้องเป็นตัวเลข 6 หลัก' })
      return
    }

    setSavingOwnerPin(true)
    try {
      await updateSettings({ ownerPin })
      setOwnerPin('')
      setSavedOwnerPin(true)
      window.setTimeout(() => setSavedOwnerPin(false), 2000)
    } catch (error) {
      showToast({ tone: 'error', title: 'บันทึกไม่สำเร็จ', message: error instanceof Error ? error.message : 'บันทึก PIN โทนี่ไม่สำเร็จ' })
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
    try {
      await updateSettings({ agentPin })
      setAgentPin('')
      setSavedAgentPin(true)
      window.setTimeout(() => setSavedAgentPin(false), 2000)
    } catch (error) {
      showToast({ tone: 'error', title: 'บันทึกไม่สำเร็จ', message: error instanceof Error ? error.message : 'บันทึก PIN ไม่สำเร็จ' })
    } finally {
      setSavingAgentPin(false)
    }
  }

  async function handleLogout() {
    await clearSession()
    router.replace('/login')
  }

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--gold)', fontSize: 18 }}>กำลังโหลด...</div>
  }

  return (
    <main className="page-container">
      <div style={{ padding: '56px 0 24px' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gold)' }}>ตั้งค่า</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
          เข้าระบบเป็น: <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{admin ? 'โทนี่ (แอดมิน)' : 'เจ้หลุยส์'}</span>
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
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            {settings?.hasOwnerPin ? 'ตั้ง PIN ใหม่ 6 หลักสำหรับแอดมิน' : 'ตั้ง PIN 6 หลักสำหรับเข้าแอปในฐานะแอดมิน'}
          </div>
          <input className="input-field" type="password" inputMode="numeric" placeholder="ตัวเลข 6 หลัก" value={ownerPin} onChange={(event) => setOwnerPin(event.target.value.replace(/\D/g, '').slice(0, 6))} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            {settings?.hasOwnerPin ? 'ตั้งไว้แล้ว ระบบจะไม่แสดง PIN เดิมเพื่อความปลอดภัย' : 'ยังไม่ได้ตั้ง PIN'}
          </div>
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
        <input className="input-field" type="password" inputMode="numeric" placeholder="ตัวเลข 6 หลัก" value={agentPin} onChange={(event) => setAgentPin(event.target.value.replace(/\D/g, '').slice(0, 6))} style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          {settings?.hasAgentPin ? 'ตั้งไว้แล้ว ระบบจะไม่แสดง PIN เดิมเพื่อความปลอดภัย' : 'ยังไม่ได้ตั้ง PIN'}
        </div>
        <button className="btn-primary" onClick={() => void handleSaveAgentPin()} disabled={savingAgentPin} style={{ fontSize: 16 }}>
          {savedAgentPin ? 'บันทึก PIN แล้ว' : savingAgentPin ? 'กำลังบันทึก...' : admin ? 'ตั้ง PIN เจ้หลุยส์' : 'บันทึก PIN ของฉัน'}
        </button>
      </div>

      <PushToggleCard />

      <button onClick={handleLogout} className="danger-chip" style={{ width: '100%', padding: '16px', borderRadius: 16, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 16 }}>
        ออกจากระบบ
      </button>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>เกี่ยวกับแอป</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <div>ห่านทองคำ v1.0</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>ระบบดูแลการลงทุนรับจำนำทอง</div>
        </div>
      </div>

      <BottomNav />
      <div style={{ height: 32 }} />
    </main>
  )
}
