export type UserRole = 'owner' | 'agent' | null

export interface AppUser {
  id: string
  role: UserRole
  display_name: string
  auth_type: 'email' | 'pin'
}

const SESSION_KEY = 'haantong_user'

function isAppUser(value: unknown): value is AppUser {
  if (!value || typeof value !== 'object') return false
  const user = value as Partial<AppUser>
  return typeof user.id === 'string'
    && (user.role === 'owner' || user.role === 'agent')
    && typeof user.display_name === 'string'
    && (user.auth_type === 'email' || user.auth_type === 'pin')
}

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'Request failed')
  }

  return payload as T
}

export function getSession(): AppUser | null {
  if (typeof window === 'undefined') return null
  try {
    const session = sessionStorage.getItem(SESSION_KEY)
    if (!session) return null
    const parsed = JSON.parse(session)
    return isAppUser(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function setSession(user: AppUser) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export async function fetchSession(): Promise<AppUser | null> {
  try {
    const payload = await readJson<{ user: AppUser }>('/api/session/current', { method: 'GET' })
    if (payload?.user && isAppUser(payload.user)) {
      setSession(payload.user)
      return payload.user
    }
  } catch {
    clearSessionLocal()
  }
  return null
}

function clearSessionLocal() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(SESSION_KEY)
}

export async function clearSession() {
  clearSessionLocal()
  try {
    await fetch('/api/session/logout', { method: 'POST', cache: 'no-store' })
  } catch {
    // Best-effort logout; local session is already gone.
  }
}

export async function hasOwnerPin(): Promise<boolean> {
  const payload = await readJson<{ hasOwnerPin: boolean }>('/api/session/setup', { method: 'GET' })
  return Boolean(payload.hasOwnerPin)
}

export async function loginOwnerWithPin(pin: string): Promise<{ user: AppUser | null, error: string | null }> {
  try {
    const payload = await readJson<{ user: AppUser }>('/api/session/login-pin', {
      method: 'POST',
      body: JSON.stringify({ mode: 'owner', pin }),
    })
    setSession(payload.user)
    return { user: payload.user, error: null }
  } catch (error) {
    return { user: null, error: error instanceof Error ? error.message : 'PIN โทนี่ไม่ถูกต้อง' }
  }
}

export async function loginOwnerWithPassword(email: string, password: string): Promise<{ user: AppUser | null, error: string | null }> {
  try {
    const payload = await readJson<{ user: AppUser }>('/api/session/login-owner-password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setSession(payload.user)
    return { user: payload.user, error: null }
  } catch (error) {
    return { user: null, error: error instanceof Error ? error.message : 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }
  }
}

export async function loginAgent(pin: string): Promise<{ user: AppUser | null, error: string | null }> {
  try {
    const payload = await readJson<{ user: AppUser }>('/api/session/login-pin', {
      method: 'POST',
      body: JSON.stringify({ mode: 'agent', pin }),
    })
    setSession(payload.user)
    return { user: payload.user, error: null }
  } catch (error) {
    return { user: null, error: error instanceof Error ? error.message : 'PIN ไม่ถูกต้อง' }
  }
}

export function canAccessSettings(user: AppUser | null): boolean {
  return user?.role === 'owner' || user?.role === 'agent'
}

export function isAdmin(user: AppUser | null): boolean {
  return user?.role === 'owner'
}
