'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { enablePushNotifications, getPushState } from '@/lib/push-client'

declare global {
  interface Navigator {
    standalone?: boolean
  }

  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  }
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export default function InstallPromptGate() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [installationAccepted, setInstallationAccepted] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [pushBlocked, setPushBlocked] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const displayModeQuery = window.matchMedia('(display-mode: standalone)')
    const legacyDisplayModeQuery = displayModeQuery as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void
    }
    const standalone = isStandaloneMode()
    const ua = window.navigator.userAgent || ''
    const mobile = /Android|iPhone|iPad|iPod/i.test(ua)
    const ios = /iPhone|iPad|iPod/i.test(ua)

    setIsStandalone(standalone)
    setIsMobile(mobile)
    setIsIos(ios)
    setStatusMessage('')

    if (!mobile || standalone) {
      setVisible(false)
      return
    }

    const revealFallback = window.setTimeout(() => {
      setVisible(true)
    }, 900)

    const handleBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent
      promptEvent.preventDefault()
      setDeferredPrompt(promptEvent)
      setVisible(true)
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setIsStandalone(true)
      setInstallationAccepted(true)
      setVisible(true)
      setStatusMessage('ติดตั้งแอปแล้ว กดปุ่มด้านล่างเพื่อเปิดการแจ้งเตือน')
    }

    const handleDisplayModeChange = () => {
      const nextStandalone = isStandaloneMode()
      setIsStandalone(nextStandalone)
      if (nextStandalone) {
        setVisible(false)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    if (typeof displayModeQuery.addEventListener === 'function') {
      displayModeQuery.addEventListener('change', handleDisplayModeChange)
    } else {
      legacyDisplayModeQuery.addListener?.(handleDisplayModeChange)
    }

    return () => {
      window.clearTimeout(revealFallback)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      if (typeof displayModeQuery.removeEventListener === 'function') {
        displayModeQuery.removeEventListener('change', handleDisplayModeChange)
      } else {
        legacyDisplayModeQuery.removeListener?.(handleDisplayModeChange)
      }
    }
  }, [])

  const instructions = useMemo(() => {
    if (isIos) {
      return [
        'เปิดลิงก์นี้ใน Safari',
        'แตะปุ่มแชร์ แล้วเลือก "Add to Home Screen"',
        'เปิด "Open as Web App" หากมี แล้วแตะ "Add"',
        'กลับหน้าจอหลัก แล้วเปิดไอคอนห่านทองคำ',
        'แตะ ⚙️ ตั้งค่า แล้วเปิดสวิตช์แจ้งเตือน',
      ]
    }

    return [
      'กดปุ่มติดตั้งด้านล่างได้เลย',
      'ถ้าเครื่องไม่เด้งหน้าติดตั้ง ให้กดเมนู browser',
      'เลือก "Install app" หรือ "Add to Home screen"',
    ]
  }, [isIos])

  async function requestNotifications() {
    setInstalling(true)
    setStatusMessage('')
    try {
      await enablePushNotifications()
      setNotificationsEnabled(true)
      setPushBlocked(false)
      setStatusMessage('ติดตั้งแอปและเปิดการแจ้งเตือนแล้ว')
    } catch (error) {
      const nextState = getPushState()
      setPushBlocked(nextState === 'blocked')
      if (nextState === 'enabled') {
        setNotificationsEnabled(true)
        setStatusMessage('การแจ้งเตือนเปิดอยู่แล้วบนเครื่องนี้')
      } else if (nextState === 'blocked') {
        setStatusMessage('ติดตั้งแอปแล้ว แต่การแจ้งเตือนถูกปิดไว้ กรุณาเปิดสิทธิ์แจ้งเตือนในการตั้งค่าเบราว์เซอร์')
      } else {
        setStatusMessage(error instanceof Error ? error.message : 'ติดตั้งแอปแล้ว แต่ยังเปิดการแจ้งเตือนไม่สำเร็จ')
      }
    } finally {
      setInstalling(false)
    }
  }

  async function handleInstall() {
    if (isIos) {
      setVisible(false)
      return
    }

    if (installationAccepted) {
      if (notificationsEnabled || pushBlocked) {
        setVisible(false)
      } else {
        await requestNotifications()
      }
      return
    }

    if (!deferredPrompt) return

    setInstalling(true)
    setStatusMessage('')
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setInstallationAccepted(true)
        setVisible(true)
        setStatusMessage('ติดตั้งแล้ว กำลังขออนุญาตเปิดการแจ้งเตือน')
        await requestNotifications()
      } else {
        setStatusMessage('ยังไม่ได้ติดตั้งแอปในรอบนี้')
      }
      setDeferredPrompt(null)
    } finally {
      setInstalling(false)
    }
  }

  if (!visible || !isMobile || (isStandalone && !installationAccepted)) {
    return null
  }

  const primaryLabel = installationAccepted
    ? installing
      ? 'กำลังเปิดการแจ้งเตือน...'
      : notificationsEnabled || pushBlocked
        ? 'เสร็จแล้ว'
        : 'เปิดการแจ้งเตือน'
    : isIos
      ? 'เข้าใจแล้ว'
      : deferredPrompt
        ? (installing ? 'กำลังเปิดหน้าติดตั้ง...' : 'ติดตั้งแอป')
        : 'รอปุ่มติดตั้งจากเบราว์เซอร์'
  const primaryDisabled = (!installationAccepted && !deferredPrompt && !isIos) || installing

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 220,
        background: 'rgba(8,8,8,0.96)',
        padding: 'max(24px, env(safe-area-inset-top)) 18px max(24px, env(safe-area-inset-bottom))',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          minHeight: '100%',
          maxWidth: 430,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 18,
        }}
      >
        <button
          type="button"
          onClick={() => setVisible(false)}
          style={{
            alignSelf: 'flex-end',
            borderRadius: 999,
            border: '1px solid rgba(242,201,76,0.18)',
            background: 'rgba(255,255,255,0.03)',
            color: 'var(--text-muted)',
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          ใช้บนเว็บก่อน
        </button>

        <div
          style={{
            borderRadius: 28,
            border: '1px solid rgba(242,201,76,0.18)',
            background:
              'radial-gradient(circle at top, rgba(242,201,76,0.14), transparent 36%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02))',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              margin: '0 auto 18px',
              borderRadius: 28,
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg, rgba(242,201,76,0.18), rgba(201,146,42,0.12))',
              border: '1px solid rgba(242,201,76,0.28)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.28)',
            }}
          >
            <Image src="/icon-192.png" alt="App icon" width={72} height={72} style={{ borderRadius: 20 }} priority />
          </div>

          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>
            ติดตั้งแอปไว้ใช้งาน
          </div>

          <div style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 20 }}>
            {installationAccepted
              ? 'ติดตั้งแอปแล้ว กดยอมรับคำขอแจ้งเตือนที่โทรศัพท์แสดง'
              : isIos
                ? 'ทำตามขั้นตอนด้านล่างเพื่อเพิ่มแอปไว้บนหน้าจอ iPhone'
                : 'แตะติดตั้ง แล้วกดยอมรับ จากนั้นกดยอมรับคำขอแจ้งเตือนที่โทรศัพท์แสดง'}
            <br />
            {isIos
              ? 'iPhone ต้องเพิ่มแอปจาก Safari ก่อน จึงจะขอเปิดแจ้งเตือนได้'
              : 'โทรศัพท์จะขออนุญาตแยกสำหรับติดตั้งและการแจ้งเตือน'}
          </div>

          <div
            style={{
              textAlign: 'left',
              borderRadius: 20,
              border: '1px solid rgba(242,201,76,0.12)',
              background: 'rgba(255,255,255,0.03)',
              padding: '16px 18px',
              marginBottom: 18,
            }}
          >
            {!installationAccepted && instructions.map((step, index) => (
                <div key={step} style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text-primary)' }}>
                  {index + 1}. {step}
                </div>
              ))}
          </div>

          {isIos && !installationAccepted && (
            <div
              style={{
                textAlign: 'left',
                borderRadius: 20,
                border: '1px solid rgba(242,201,76,0.12)',
                background: 'rgba(255,255,255,0.02)',
                padding: '16px 18px',
                marginBottom: 18,
                color: 'var(--text-secondary)',
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              การติดตั้งและการแจ้งเตือนบน iPhone ต้องยืนยันแยกกัน
              เปิดแอปจากไอคอนก่อน แล้วใช้ปุ่มแจ้งเตือนในหน้าแรกหรือ ⚙️ ตั้งค่า
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleInstall()}
            disabled={primaryDisabled}
            className="btn-primary"
            style={{
              opacity: primaryDisabled ? 0.6 : 1,
              marginBottom: 10,
            }}
          >
            {primaryLabel}
          </button>

          {!deferredPrompt && !isIos && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              ถ้าเครื่องยังไม่ขึ้นปุ่มติดตั้ง อาจต้องเปิดผ่าน Chrome หรือรอสักครู่หลังหน้าเว็บโหลดเสร็จ
            </div>
          )}

          {statusMessage && (
            <div
              style={{
                marginTop: 12,
                borderRadius: 16,
                border: '1px solid rgba(242,201,76,0.2)',
                background: 'rgba(242,201,76,0.08)',
                color: 'var(--gold-light)',
                padding: '12px 14px',
                fontSize: 14,
                lineHeight: 1.5,
                textAlign: 'left',
              }}
            >
              {statusMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
