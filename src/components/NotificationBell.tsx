'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  enablePushNotifications,
  isIosDevice,
  isStandaloneMode,
  resolvePushState,
  type PushState,
} from '@/lib/push-client'

type NotificationItem = {
  id: string
  type: string
  title: string
  body: string
  url: string
  created_at: string
}

type PendingActionItem = {
  id: string
  type: 'pending_transfer' | 'pending_redeem'
  title: string
  body: string
  url: string
}

type NotificationCache = {
  notifications: NotificationItem[]
  pendingActions: PendingActionItem[]
  savedAt: number
}

const CACHE_KEY = 'notification-bell:feed'
const CACHE_TTL_MS = 30 * 1000

function relativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const diffMin = Math.max(1, Math.round(diffMs / 60000))
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`
  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return `${diffHour} ชม. ที่แล้ว`
  const diffDay = Math.round(diffHour / 24)
  return `${diffDay} วันที่แล้ว`
}

export default function NotificationBell() {
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pushState, setPushState] = useState<PushState>('default')
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMessage, setPushMessage] = useState('')
  const [iosInstallNeeded, setIosInstallNeeded] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [pendingActions, setPendingActions] = useState<PendingActionItem[]>([])

  const needsPushPrompt = pushState !== 'enabled'
  const total = notifications.length + pendingActions.length

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    const cacheStale = hydrateFromCache()
    setIosInstallNeeded(isIosDevice() && !isStandaloneMode())

    let staleTimer: ReturnType<typeof setTimeout> | null = null
    if (cacheStale) {
      staleTimer = globalThis.setTimeout(() => {
        void loadNotifications(false)
      }, 900)
    }

    const resolveState = () => {
      void resolvePushState().then(setPushState)
    }

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(resolveState, { timeout: 1200 })
      return () => {
        if (staleTimer) globalThis.clearTimeout(staleTimer)
        window.cancelIdleCallback(idleId)
      }
    }

    const timer = globalThis.setTimeout(resolveState, 300)
    return () => {
      if (staleTimer) globalThis.clearTimeout(staleTimer)
      globalThis.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (open) {
      void loadNotifications(true)
    }
  }, [open])

  function hydrateFromCache() {
    if (typeof window === 'undefined') return true

    try {
      const raw = window.sessionStorage.getItem(CACHE_KEY)
      if (!raw) return true
      const cached = JSON.parse(raw) as NotificationCache
      setNotifications(Array.isArray(cached.notifications) ? cached.notifications : [])
      setPendingActions(Array.isArray(cached.pendingActions) ? cached.pendingActions : [])
      return Date.now() - Number(cached.savedAt || 0) > CACHE_TTL_MS
    } catch {
      // Ignore invalid cache and refetch on demand.
      return true
    }
  }

  function saveCache(nextNotifications: NotificationItem[], nextPendingActions: PendingActionItem[]) {
    if (typeof window === 'undefined') return
    const payload: NotificationCache = {
      notifications: nextNotifications,
      pendingActions: nextPendingActions,
      savedAt: Date.now(),
    }
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  }

  async function loadNotifications(forceOpenRefresh = false) {
    if (!forceOpenRefresh && typeof window !== 'undefined') {
      try {
        const raw = window.sessionStorage.getItem(CACHE_KEY)
        if (raw) {
          const cached = JSON.parse(raw) as NotificationCache
          if (Date.now() - Number(cached.savedAt || 0) <= CACHE_TTL_MS) {
            return
          }
        }
      } catch {
        // Ignore invalid cache and fetch fresh data.
      }
    }

    try {
      const response = await fetch('/api/notifications/recent', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) return
      const nextNotifications = Array.isArray(payload.notifications) ? payload.notifications : []
      const nextPendingActions = Array.isArray(payload.pendingActions) ? payload.pendingActions : []
      setNotifications(nextNotifications)
      setPendingActions(nextPendingActions)
      saveCache(nextNotifications, nextPendingActions)
    } catch {
      // best-effort
    }
  }

  async function handleEnablePush() {
    setPushBusy(true)
    setPushMessage('')

    try {
      await enablePushNotifications()
      setPushState('enabled')
      setPushMessage('เปิดแจ้งเตือนบนเครื่องนี้แล้ว')
    } catch (error) {
      setPushState(await resolvePushState())
      setPushMessage(error instanceof Error ? error.message : 'เปิดแจ้งเตือนไม่สำเร็จ')
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="การแจ้งเตือน"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 24, color: needsPushPrompt ? 'var(--gold-light)' : 'var(--text-primary)' }}>🔔</span>

        {total > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -1,
              right: -1,
              background: 'linear-gradient(135deg,#C9922A,#F2C94C)',
              color: '#080808',
              fontSize: 11,
              fontWeight: 800,
              borderRadius: 99,
              minWidth: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            {total}
          </span>
        )}

        {needsPushPrompt && (
          <span
            style={{
              position: 'absolute',
              bottom: 4,
              right: 5,
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: '#D1554F',
              border: '2px solid var(--black-900)',
            }}
          />
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 46,
            right: 0,
            background: 'var(--black-800)',
            border: '1px solid var(--border)',
            borderRadius: 18,
            padding: 8,
            minWidth: 320,
            zIndex: 100,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 12px 8px', fontWeight: 700, letterSpacing: 0.5 }}>
            การแจ้งเตือนและงานค้าง
          </div>

          {needsPushPrompt && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 14,
                background: 'rgba(242,201,76,0.06)',
                border: '1px solid rgba(242,201,76,0.14)',
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold-light)' }}>เปิดแจ้งเตือนบนเครื่องนี้</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.45 }}>
                    เวลาเกิดรายการใหม่ แอปจะบอกว่าเกิดอะไรขึ้นและกดเข้าไปยังรายการนั้นได้เลย
                  </div>
                </div>
                <span className="badge-pending">ยังไม่เปิด</span>
              </div>

              {iosInstallNeeded && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 8 }}>
                  บน iPhone ให้เพิ่มแอปไว้ที่หน้าจอก่อน แล้วค่อยเปิดจากไอคอนนั้นเพื่ออนุญาตแจ้งเตือน
                </div>
              )}

              {pushState === 'blocked' && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 8 }}>
                  เครื่องนี้เคยบล็อกแจ้งเตือนไว้ ต้องกลับไปเปิดที่การตั้งค่าของเบราว์เซอร์หรือแอปก่อน
                </div>
              )}

              {pushState === 'unsupported' && !iosInstallNeeded && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 8 }}>
                  เครื่องนี้ยังไม่รองรับการแจ้งเตือนแบบแอป หรือยังไม่ได้เปิดจากเบราว์เซอร์ที่รองรับ
                </div>
              )}

              <button
                type="button"
                className="btn-primary"
                onClick={() => void handleEnablePush()}
                disabled={pushBusy || pushState === 'unsupported'}
                style={{ fontSize: 14, padding: '12px 14px', minHeight: 46 }}
              >
                {pushBusy ? 'กำลังเปิด...' : 'เปิดแจ้งเตือน'}
              </button>

              {pushMessage && (
                <div style={{ fontSize: 12, color: 'var(--gold-light)', marginTop: 8, lineHeight: 1.45 }}>
                  {pushMessage}
                </div>
              )}
            </div>
          )}

          {pendingActions.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: 'var(--gold)', padding: '4px 12px 8px', fontWeight: 700 }}>
                รายการค้างที่ต้องทำ
              </div>
              {pendingActions.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    router.push(item.url || '/')
                    setOpen(false)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: 'rgba(242,201,76,0.08)',
                    marginBottom: 6,
                    border: '1px solid rgba(242,201,76,0.18)',
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1.2, marginTop: 2, color: 'var(--gold-light)' }}>!</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.45 }}>
                      {item.body}
                    </div>
                  </div>
                  <span style={{ fontSize: 16, color: 'var(--gold)', flexShrink: 0 }}>›</span>
                </div>
              ))}
            </>
          )}

          {notifications.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 12px 8px', fontWeight: 700 }}>
              แจ้งเตือนล่าสุด
            </div>
          )}

          {notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                router.push(item.url || '/')
                setOpen(false)
              }}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                cursor: 'pointer',
                background: 'rgba(242,201,76,0.05)',
                marginBottom: 6,
                border: '1px solid rgba(242,201,76,0.12)',
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1.2, marginTop: 2, color: 'var(--gold)' }}>•</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold-light)' }}>{item.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.45 }}>
                  {item.body}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                  {relativeTime(item.created_at)}
                </div>
              </div>
              <span style={{ fontSize: 16, color: 'var(--gold)', flexShrink: 0 }}>›</span>
            </div>
          ))}

          {total === 0 && (
            <div style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>
              ตอนนี้ยังไม่มีแจ้งเตือนหรือรายการค้าง
            </div>
          )}
        </div>
      )}
    </div>
  )
}
