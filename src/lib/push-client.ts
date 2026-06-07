import { VAPID_PUBLIC_KEY } from '@/lib/push-config'

export type PushState = 'unsupported' | 'blocked' | 'default' | 'enabled'

type SubscriptionEnvelope = {
  endpoint: string
  expirationTime: number | null
  keys?: {
    p256dh?: string
    auth?: string
  }
}

function base64UrlToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

async function getRuntimePublicKey() {
  try {
    const response = await fetch('/api/push/public-key', { cache: 'no-store' })
    if (!response.ok) return VAPID_PUBLIC_KEY
    const payload = await response.json()
    return typeof payload?.publicKey === 'string' && payload.publicKey ? payload.publicKey : VAPID_PUBLIC_KEY
  } catch {
    return VAPID_PUBLIC_KEY
  }
}

function mapPermission(): PushState {
  if (typeof window === 'undefined') return 'unsupported'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported'
  }
  if (Notification.permission === 'granted') return 'enabled'
  if (Notification.permission === 'denied') return 'blocked'
  return 'default'
}

export function getPushState() {
  return mapPermission()
}

export async function resolvePushState(): Promise<PushState> {
  const state = mapPermission()
  if (state !== 'enabled') return state
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  return subscription ? 'enabled' : 'default'
}

export function isStandaloneMode() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
}

export function isIosDevice() {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

export async function registerPushWorker() {
  if (!('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

async function saveSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON() as SubscriptionEnvelope
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(json),
  })
}

export async function enablePushNotifications() {
  const state = mapPermission()
  if (state === 'unsupported') {
    throw new Error('อุปกรณ์นี้ยังไม่รองรับการแจ้งเตือนแบบแอป')
  }

  if (isIosDevice() && !isStandaloneMode()) {
    throw new Error('บน iPhone ต้องเปิดแอปจากไอคอนที่เพิ่มไว้บนหน้าจอก่อน จึงจะเปิดแจ้งเตือนได้')
  }

  const registration = await registerPushWorker()
  if (!registration) {
    throw new Error('ยังเปิด service worker ไม่ได้')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('ยังไม่ได้อนุญาตแจ้งเตือน')
  }

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    try {
      const publicKey = await getRuntimePublicKey()
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(publicKey),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message.includes('Registration failed')) {
        throw new Error('Registration failed - push service error. มักเกิดจาก iPhone ยังไม่ได้เปิดจากไอคอนบนหน้าจอ หรือ VAPID key ของเว็บยังไม่ถูกต้อง')
      }
      if (message.toLowerCase().includes('permission') || message.toLowerCase().includes('denied')) {
        throw new Error('ยังไม่ได้อนุญาตแจ้งเตือนบนเครื่องนี้')
      }
      throw error
    }
  }

  await saveSubscription(subscription)
  return subscription
}

export async function disablePushNotifications() {
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) {
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    })
    await subscription.unsubscribe()
  }
}

export async function sendPushTest() {
  const response = await fetch('/api/push/dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'test' }),
  })
  if (!response.ok) {
    throw new Error('ระบบส่งแจ้งเตือนยังไม่ถูกเปิดกุญแจบนเซิร์ฟเวอร์')
  }
}

export async function pingPushDispatch() {
  try {
    await fetch('/api/push/dispatch', { method: 'POST' })
  } catch {}
}
