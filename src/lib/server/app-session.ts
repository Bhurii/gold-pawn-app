import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import type { FundOwnerKey, UserRole } from '@/lib/fund-owner'

export type SessionUserRole = UserRole

export type SessionUser = {
  id: string
  role: SessionUserRole
  user_key: FundOwnerKey
  display_name: string
  auth_type: 'email' | 'pin'
}

type SessionPayload = {
  user: SessionUser
  exp: number
}

const COOKIE_NAME = 'haanthong_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14
export const SESSION_COOKIE_NAME = COOKIE_NAME

function getSessionSecret() {
  return process.env.APP_SESSION_SECRET
    || process.env.VAPID_PRIVATE_KEY_PEM
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || 'haanthong-dev-secret'
}

function toBase64Url(value: Buffer | string) {
  const buffer = typeof value === 'string' ? Buffer.from(value, 'utf8') : value
  return buffer.toString('base64url')
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url')
}

function sign(value: string) {
  return createHmac('sha256', getSessionSecret()).update(value).digest('base64url')
}

export function encodeSession(user: SessionUser) {
  const payload: SessionPayload = {
    user,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  }
  const encodedPayload = toBase64Url(JSON.stringify(payload))
  const signature = sign(encodedPayload)
  return `${encodedPayload}.${signature}`
}

export function decodeSession(value?: string | null): SessionUser | null {
  if (!value) return null

  const [encodedPayload, signature] = value.split('.')
  if (!encodedPayload || !signature) return null

  const expected = sign(encodedPayload)
  if (signature.length !== expected.length) return null
  const isValid = timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  if (!isValid) return null

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload).toString('utf8')) as SessionPayload
    if (!payload?.user || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload.user
  } catch {
    return null
  }
}

export function readSessionFromRequest(request: NextRequest) {
  return decodeSession(request.cookies.get(COOKIE_NAME)?.value)
}

export function applySessionCookie(response: NextResponse, user: SessionUser) {
  response.cookies.set(COOKIE_NAME, encodeSession(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}
