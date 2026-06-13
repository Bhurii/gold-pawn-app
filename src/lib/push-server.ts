import { sign } from 'node:crypto'
import { createAdminClient } from '@/lib/server/admin'
import { parseNotificationAction } from '@/lib/notification-meta'
import { VAPID_PUBLIC_KEY } from '@/lib/push-config'
import { VAPID_PRIVATE_KEY_PEM, VAPID_SUBJECT } from '@/lib/push-server-secret'

type NotificationRow = {
  id: string
  type: string
  message: string
  pawn_id?: string | null
  action_url?: string | null
  created_at: string
}

type PushSubscriptionRecord = {
  id: string
  message: string
}

type StoredSubscription = {
  endpoint: string
  expirationTime?: number | null
  keys?: {
    p256dh?: string
    auth?: string
  }
  enabled?: boolean
  updatedAt?: string
  role?: 'owner' | 'agent'
  userId?: string
  displayName?: string
}

const INTERNAL_NOTIFICATION_TYPES = new Set([
  'push_subscription',
  'owner_pin_config',
  'push_test_marker',
])

function supabaseServer() {
  return createAdminClient()
}

function toBase64Url(input: Buffer | string) {
  const buffer = typeof input === 'string' ? Buffer.from(input) : input
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function derToJose(signature: Buffer) {
  const rLength = signature[3]
  let r = signature.subarray(4, 4 + rLength)
  const sLengthIndex = 4 + rLength + 1
  const sLength = signature[sLengthIndex]
  let s = signature.subarray(sLengthIndex + 1, sLengthIndex + 1 + sLength)

  if (r.length > 32) r = r.subarray(r.length - 32)
  if (s.length > 32) s = s.subarray(s.length - 32)

  return Buffer.concat([
    Buffer.alloc(32 - r.length, 0),
    r,
    Buffer.alloc(32 - s.length, 0),
    s,
  ])
}

function buildAudience(endpoint: string) {
  const url = new URL(endpoint)
  return `${url.protocol}//${url.host}`
}

function buildJwt(aud: string) {
  if (!VAPID_PRIVATE_KEY_PEM) {
    throw new Error('Push private key is not configured')
  }
  const header = toBase64Url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  const claims = toBase64Url(JSON.stringify({
    aud,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 12),
    sub: VAPID_SUBJECT,
  }))
  const body = `${header}.${claims}`
  const signature = sign('sha256', Buffer.from(body), VAPID_PRIVATE_KEY_PEM)
  return `${body}.${toBase64Url(derToJose(signature))}`
}

async function disableSubscription(id: string, payload: StoredSubscription) {
  const supabase = supabaseServer()
  await supabase
    .from('notifications')
    .update({
      message: JSON.stringify({
        ...payload,
        enabled: false,
        updatedAt: new Date().toISOString(),
      }),
    })
    .eq('id', id)
}

function parseStoredSubscription(row: PushSubscriptionRecord): (StoredSubscription & { id: string }) | null {
  try {
    const parsed = JSON.parse(row.message) as StoredSubscription
    if (!parsed.endpoint) return null
    return {
      id: row.id,
      ...parsed,
      enabled: parsed.enabled !== false,
    }
  } catch {
    return null
  }
}

async function listSubscriptions() {
  const supabase = supabaseServer()
  const { data } = await supabase
    .from('notifications')
    .select('id,message')
    .eq('type', 'push_subscription')
    .order('created_at', { ascending: false })

  return (data || [])
    .map((row) => parseStoredSubscription(row as PushSubscriptionRecord))
    .filter((row): row is StoredSubscription & { id: string } => Boolean(row))
}

export async function upsertPushSubscription(payload: StoredSubscription) {
  const supabase = supabaseServer()
  const nextPayload = {
    ...payload,
    enabled: true,
    updatedAt: new Date().toISOString(),
  }

  const existing = (await listSubscriptions()).find((row) => row.endpoint === payload.endpoint)

  if (existing) {
    await supabase
      .from('notifications')
      .update({ message: JSON.stringify(nextPayload) })
      .eq('id', existing.id)
    return
  }

  await supabase.from('notifications').insert({
    type: 'push_subscription',
    message: JSON.stringify(nextPayload),
    is_read: true,
  })
}

export async function unsubscribePushSubscription(endpoint: string) {
  const target = (await listSubscriptions()).find((row) => row.endpoint === endpoint)
  if (!target) return
  await disableSubscription(target.id, target)
}

async function getSubscriptionRole(endpoint?: string | null) {
  if (!endpoint) return null
  const subscription = (await listSubscriptions()).find((row) => row.endpoint === endpoint && row.enabled)
  return subscription?.role || null
}

function canRoleReceiveType(type: string, role?: 'owner' | 'agent' | null) {
  if (!role) return true

  const ownerOnlyTypes = new Set([
    'pawn_created',
    'interest_paid',
    'renewed',
    'topup',
    'transfer_confirmed',
    'bypass_cash',
    'bypass_prepaid',
    'loan_created',
    'loan_interest_paid',
    'loan_principal_paid',
    'loan_closed',
    'other_income_added',
  ])

  const agentAndOwnerTypes = new Set([
    'redeem_confirmed',
    'push_test',
  ])

  if (ownerOnlyTypes.has(type)) return role === 'owner'
  if (agentAndOwnerTypes.has(type)) return role === 'owner' || role === 'agent'
  if (type === 'redeem_pending') return role === 'owner'
  return true
}

function getNotificationTitle(type: string) {
  if (type === 'pawn_created') return 'มีตั๋วรอโอนเงิน'
  if (type === 'redeem_pending') return 'มีรายการรอยืนยันไถ่ถอน'
  if (type === 'redeem_confirmed') return 'ยืนยันไถ่ถอนแล้ว'
  if (type === 'renewed') return 'ลดต้นสำเร็จ'
  if (type === 'topup') return 'เพิ่มยอดสำเร็จ'
  if (type === 'push_test') return 'ทดสอบแจ้งเตือน'
  if (type === 'transfer_confirmed') return 'ยืนยันโอนเงินแล้ว'
  if (type === 'interest_paid') return 'มีการตัดดอก'
  if (type === 'bypass_cash') return 'เคลียร์เงินสดแล้ว'
  if (type === 'bypass_prepaid') return 'ฝากเงินล่วงหน้าแล้ว'
  if (type === 'loan_created') return 'มีรายการปล่อยกู้ใหม่'
  if (type === 'loan_interest_paid') return 'มีการรับดอกสินเชื่อ'
  if (type === 'loan_principal_paid') return 'มีการตัดต้นสินเชื่อ'
  if (type === 'loan_closed') return 'ปิดสินเชื่อแล้ว'
  if (type === 'other_income_added') return 'มีรายได้ใหม่เข้าระบบ'
  return 'ห่านทองคำ'
}

export async function getLatestPushPayload(endpoint?: string | null) {
  const supabase = supabaseServer()
  const role = await getSubscriptionRole(endpoint)
  const { data } = await supabase
    .from('notifications')
    .select('id,type,message,pawn_id,action_url,created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  const latest = (data as NotificationRow[] | null)?.find((item) => {
    if (INTERNAL_NOTIFICATION_TYPES.has(item.type)) return false
    return canRoleReceiveType(item.type, role)
  })

  if (!latest) {
    return {
      title: 'ห่านทองคำ',
      body: 'มีอัปเดตใหม่ในแอป',
      url: '/',
      tag: 'haanthong-default',
    }
  }

  const meta = parseNotificationAction(latest.action_url)
  let url = meta.url || (latest.pawn_id ? `/pawns/${latest.pawn_id}` : '/')
  const title = getNotificationTitle(latest.type)

  if (latest.type === 'redeem_pending' && latest.pawn_id) {
    const { data: redeem } = await supabase
      .from('redemptions')
      .select('id')
      .eq('pawn_id', latest.pawn_id)
      .eq('status', 'pending_confirm')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (redeem?.id) url = `/redeem/confirm/${redeem.id}`
  }

  return {
    title,
    body: latest.message,
    url,
    tag: `haanthong-${latest.type}`,
  }
}

async function sendSignal(endpoint: string) {
  const audience = buildAudience(endpoint)
  const jwt = buildJwt(audience)
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `WebPush ${jwt}`,
      'Crypto-Key': `p256ecdsa=${VAPID_PUBLIC_KEY}`,
      TTL: '60',
      Urgency: 'high',
    },
  })
}

export async function dispatchPushSignals() {
  if (!VAPID_PRIVATE_KEY_PEM) {
    return { subscribed: 0, delivered: 0, disabled: true }
  }

  const subscriptions = new Map<string, StoredSubscription & { id: string }>()
  ;(await listSubscriptions()).forEach((row) => {
    if (row.enabled) subscriptions.set(row.endpoint, row)
  })

  const results = await Promise.allSettled(
    [...subscriptions.values()].map(async (subscription) => {
      const response = await sendSignal(subscription.endpoint)
      if (!response.ok && (response.status === 404 || response.status === 410)) {
        await disableSubscription(subscription.id, subscription)
      }
      return response.ok
    }),
  )

  return {
    subscribed: subscriptions.size,
    delivered: results.filter((result) => result.status === 'fulfilled' && result.value).length,
  }
}

export async function createPushTestNotification(displayName = 'เครื่องนี้') {
  const supabase = supabaseServer()
  await supabase.from('notifications').insert({
    type: 'push_test',
    message: 'นี่คือแจ้งเตือนทดสอบจากห่านทองคำ เปิดได้แล้วเด้งเหมือนแอปจริง',
    is_read: false,
  })
}
