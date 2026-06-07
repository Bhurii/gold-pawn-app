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
  title?: string
}

export default function PushToggleCard({ title = 'แจ้งเตือนแบบแอป' }: Props) {
  const [state, setState] = useState<PushState>('default')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [iosInstallNeeded, setIosInstallNeeded] = useState(false)

  useEffect(() => {
    void resolvePushState().then(setState)
    setIosInstallNeeded(isIosDevice() && !isStandaloneMode())
  }, [])

  async function handleToggle() {
    setBusy(true)
    setMessage('')

    try {
      if (state === 'enabled') {
        await disablePushNotifications()
        setState(await resolvePushState())
        setMessage('ปิดแจ้งเตือนบนเครื่องนี้แล้ว')
      } else {
        await enablePushNotifications()
        setState('enabled')
        setMessage('เปิดแจ้งเตือนบนเครื่องนี้แล้ว')
      }
    } catch (error) {
      setState(await resolvePushState())
      setMessage(error instanceof Error ? error.message : 'เปลี่ยนสถานะแจ้งเตือนไม่สำเร็จ')
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ส่งแจ้งเตือนทดสอบไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const enabled = state === 'enabled'
  const disabledBySetup = state === 'unsupported' || state === 'blocked'

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            เปิดไว้แล้วมือถือเครื่องนี้จะเด้งแม้ไม่ได้เปิดแอป
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => void handleToggle()}
          disabled={busy || state === 'unsupported'}
          style={{
            width: 58,
            height: 34,
            borderRadius: 999,
            border: `1px solid ${enabled ? 'rgba(242,201,76,0.36)' : 'var(--border-hover)'}`,
            background: enabled ? 'linear-gradient(135deg,#C9922A,#F2C94C)' : 'rgba(255,255,255,0.04)',
            padding: 3,
            cursor: busy || state === 'unsupported' ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.75 : 1,
            transition: 'all 0.2s',
          }}
        >
          <span
            style={{
              display: 'block',
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: enabled ? '#080808' : 'var(--gold-light)',
              transform: `translateX(${enabled ? 24 : 0}px)`,
              transition: 'transform 0.2s',
            }}
          />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span className={enabled ? 'badge-active' : 'badge-pending'}>
          {enabled ? 'เปิดอยู่' : 'ยังไม่เปิด'}
        </span>
        {busy && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>กำลังอัปเดต...</span>}
      </div>

      {iosInstallNeeded && (
        <div className="info-note" style={{ marginTop: 12, marginBottom: 0 }}>
          บน iPhone ให้เพิ่มแอปไว้ที่หน้าจอก่อน แล้วค่อยเปิดจากไอคอนนั้นเพื่ออนุญาตแจ้งเตือน
        </div>
      )}

      {state === 'blocked' && (
        <div className="info-note" style={{ marginTop: 12, marginBottom: 0 }}>
          เครื่องนี้เคยบล็อกแจ้งเตือนไว้ ต้องกลับไปเปิดที่การตั้งค่าของเบราว์เซอร์หรือแอปที่ปักหน้าจอก่อน
        </div>
      )}

      {state === 'unsupported' && !iosInstallNeeded && (
        <div className="info-note" style={{ marginTop: 12, marginBottom: 0 }}>
          เครื่องนี้ยังไม่รองรับการแจ้งเตือนแบบแอป หรือยังไม่ได้เปิดจากเบราว์เซอร์ที่รองรับ
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginTop: 12 }}>
        <button className="btn-secondary" type="button" onClick={() => void handleTest()} disabled={busy || state !== 'enabled'}>
          ทดสอบแจ้งเตือน
        </button>
      </div>

      {message && (
        <div
          className={disabledBySetup && !enabled ? 'info-note' : 'soft-success'}
          style={{ marginTop: 12, marginBottom: 0, padding: '10px 12px', fontSize: 13 }}
        >
          {message}
        </div>
      )}
    </div>
  )
}
