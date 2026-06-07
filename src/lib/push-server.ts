import { sign } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { requirePublicEnv } from '@/lib/env'
import { VAPID_PUBLIC_KEY } from '@/lib/push-config'
import { VAPID_PRIVATE_KEY_PEM, VAPID_SUBJECT } from '@/lib/push-server-secret'

type NotificationRow = {
  id: string
  type: string
  message: string
  pawn_id?: string | null
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
}

const INTERNAL_NOTIFICATION_TYPES = new Set([
  'push_subscription',
  'push_test_marker',
])

function supabaseServer() {
  return createClient(
    requirePublicEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requirePublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
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

export async function upsertPushSubscription(payload: StoredSubscription) {
  const supabase = supabaseServer()
  const nextPayload = {
    ...payload,
    enabled: true,
    updatedAt: new Date().toISOString(),
  }
  const { data } = await supabase
    .from('notifications')
    .select('id,message')
    .eq('type', 'push_subscription')
    .order('created_at', { ascending: false })

  const existing = (data || [])
    .map((row) => parseStoredSubscription(row as PushSubscriptionRecord))
    .find((row) => row?.endpoint === payload.endpoint)

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
  const supabase = supabaseServer()
  const { data } = await supabase
    .from('notifications')
    .select('id,message')
    .eq('type', 'push_subscription')

  const target = (data || [])
    .map((row) => parseStoredSubscription(row as PushSubscriptionRecord))
    .find((row) => row?.endpoint === endpoint)

  if (!target) return
  await disableSubscription(target.id, target)
}

export async function getLatestPushPayload() {
  const supabase = supabaseServer()
  const { data } = await supabase
    .from('notifications')
    .select('id,type,message,pawn_id,created_at')
    .order('created_at', { ascending: false })
    .limit(30)

  const latest = (data as NotificationRow[] | null)?.find((item) => !INTERNAL_NOTIFICATION_TYPES.has(item.type))
  if (!latest) {
    return {
      title: 'ห่านทองคำ',
      body: 'มีอัปเดตใหม่ในแอป',
      url: '/',
      tag: 'haanthong-default',
    }
  }

  let url = latest.pawn_id ? `/pawns/${latest.pawn_id}` : '/'
  let title = 'ห่านทองคำ'

  if (latest.type === 'pawn_created') title = 'มีตั๋วรอโอนเงิน'
  else if (latest.type === 'redeem_pending') title = 'มีรายการรอยืนยันคืน'
  else if (latest.type === 'redeem_confirmed') title = 'ยืนยันคืนห่านแล้ว'
  else if (latest.type === 'renewed') title = 'ลดต้นสำเร็จ'
  else if (latest.type === 'topup') title = 'เพิ่มยอดสำเร็จ'
  else if (latest.type === 'push_test') title = 'ทดสอบแจ้งเตือน'
  else if (latest.type === 'transfer_confirmed') title = 'ยืนยันโอนเงินแล้ว'

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

  const supabase = supabaseServer()
  const { data } = await supabase
    .from('notifications')
    .select('id,message')
    .eq('type', 'push_subscription')

  const subscriptions = new Map<string, StoredSubscription & { id: string }>()
  ;(data || []).forEach((row) => {
    const parsed = parseStoredSubscription(row as PushSubscriptionRecord)
    if (parsed?.enabled) subscriptions.set(parsed.endpoint, parsed)
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

export async function createPushTestNotification() {
  const supabase = supabaseServer()
  await supabase.from('notifications').insert({
    type: 'push_test',
    message: 'นี่คือแจ้งเตือนทดสอบจากห่านทองคำ เปิดได้แล้วเด้งเหมือนแอปจริง',
    is_read: false,
  })
}
