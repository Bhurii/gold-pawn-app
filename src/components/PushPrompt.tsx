'use client'

import { useEffect, useState } from 'react'
import {
  disablePushNotifications,
  enablePushNotifications,
  isIosDevice,
  isStandaloneMode,
  resolvePushState,
  sendPushTest,
  type PushState,
} from '@/lib/push-client'

type Props = {
  compact?: boolean
}

export default function PushPrompt({ compact = false }: Props) {
  const [state, setState] = useState<PushState>('default')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [iosInstallNeeded, setIosInstallNeeded] = useState(false)

  useEffect(() => {
    void resolvePushState().then(setState)
    setIosInstallNeeded(isIosDevice() && !isStandaloneMode())
  }, [])

  async function handleEnable() {
    setBusy(true)
    setMessage('')
    try {
      await enablePushNotifications()
      setState('enabled')
      setMessage('เปิดแจ้งเตือนแล้ว มือถือจะเริ่มเด้งเมื่อมีงานใหม่')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'เปิดแจ้งเตือนไม่สำเร็จ')
      void resolvePushState().then(setState)
    } finally {
      setBusy(false)
    }
  }

  async function handleDisable() {
    setBusy(true)
    setMessage('')
    try {
      await disablePushNotifications()
      const nextState = await resolvePushState()
      setState(nextState)
      setMessage('ปิดแจ้งเตือนบนเครื่องนี้แล้ว')
    } catch {
      setMessage('ปิดแจ้งเตือนไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  async function handleTest() {
    setBusy(true)
    setMessage('')
    try {
      await sendPushTest()
      setMessage('ส่งแจ้งเตือนทดสอบแล้ว ลองปิดแอปไว้แล้วรอดูได้เลย')
    } catch {
      setMessage('ส่งแจ้งเตือนทดสอบไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: compact ? 14 : 16, padding: compact ? 16 : 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: compact ? 16 : 17, fontWeight: 800, color: 'var(--gold-ivory)' }}>แจ้งเตือนแบบแอป</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
            เปิดแล้วมือถือจะเด้งแม้ไม่ได้เปิดแอป โดยเฉพาะบน iPhone ให้เพิ่มไว้ที่หน้าจอก่อน
          </div>
        </div>
        <span className={state === 'enabled' ? 'badge-active' : 'badge-pending'}>
          {state === 'enabled' ? 'พร้อมเด้ง' : 'ยังไม่เปิด'}
        </span>
      </div>

      {iosInstallNeeded && (
        <div className="info-note" style={{ marginBottom: 12 }}>
          บน iPhone ให้กด Share แล้วเลือก Add to Home Screen ก่อน จากนั้นค่อยเปิดแอปจากไอคอนที่ปักไว้แล้วกดอนุญาตแจ้งเตือน
        </div>
      )}

      {state === 'unsupported' && (
        <div className="info-note" style={{ marginBottom: 12 }}>
          เครื่องนี้ยังไม่รองรับแจ้งเตือนแบบ PWA หรือยังไม่ได้เปิดจากเบราว์เซอร์ที่รองรับ
        </div>
      )}

      {state === 'blocked' && (
        <div className="info-note" style={{ marginBottom: 12 }}>
          เครื่องนี้เคยบล็อกแจ้งเตือนไว้ ต้องเข้าไปเปิดที่การตั้งค่าของเบราว์เซอร์หรือแอปที่ปักหน้าจอก่อน
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10 }}>
        <button className="btn-primary" type="button" onClick={handleEnable} disabled={busy || state === 'unsupported'}>
          {busy ? 'กำลังเปิด...' : state === 'enabled' ? 'เปิดแล้ว' : 'เปิดแจ้งเตือน'}
        </button>
        <button className="btn-secondary" type="button" onClick={handleTest} disabled={busy || state !== 'enabled'}>
          ทดสอบเด้ง
        </button>
        {!compact && (
          <button className="btn-secondary" type="button" onClick={handleDisable} disabled={busy || state !== 'enabled'}>
            ปิดบนเครื่องนี้
          </button>
        )}
      </div>

      {compact && state === 'enabled' && (
        <button
          className="btn-secondary"
          type="button"
          onClick={handleDisable}
          disabled={busy}
          style={{ marginTop: 10 }}
        >
          ปิดบนเครื่องนี้
        </button>
      )}

      {message && (
        <div style={{ fontSize: 13, color: 'var(--gold-light)', marginTop: 12, lineHeight: 1.5 }}>
          {message}
        </div>
      )}
    </div>
  )
}
