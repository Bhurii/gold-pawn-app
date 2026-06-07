import { supabase } from './supabase'

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

export function clearSession() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(SESSION_KEY)
  void supabase.auth.signOut()
}

export async function hasOwnerPin(): Promise<boolean> {
  const { data } = await supabase.from('settings').select('owner_pin').single()
  return Boolean(data?.owner_pin)
}

export async function loginOwnerWithPin(pin: string): Promise<{ user: AppUser | null, error: string | null }> {
  const { data: settings } = await supabase.from('settings').select('owner_pin').single()
  if (!settings?.owner_pin) {
    return { user: null, error: 'ยังไม่ได้ตั้ง PIN เจ้าของ กรุณาเข้าแบบเดิมก่อน แล้วค่อยไปตั้งในหน้าตั้งค่า' }
  }
  if (settings.owner_pin !== pin) {
    return { user: null, error: 'PIN เจ้าของไม่ถูกต้อง' }
  }

  const user: AppUser = { id: 'owner', role: 'owner', display_name: 'เจ้าของ', auth_type: 'pin' }
  setSession(user)
  return { user, error: null }
}

export async function loginOwnerWithPassword(email: string, password: string): Promise<{ user: AppUser | null, error: string | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) return { user: null, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }

  const { data: role } = await supabase.from('user_roles').select('*').eq('user_id', data.user.id).single()
  if (!role || role.role !== 'owner') return { user: null, error: 'ไม่มีสิทธิ์เข้าใช้งาน' }

  const user: AppUser = {
    id: data.user.id,
    role: 'owner',
    display_name: role.display_name || 'เจ้าของ',
    auth_type: 'email',
  }
  setSession(user)
  return { user, error: null }
}

export async function loginAgent(pin: string): Promise<{ user: AppUser | null, error: string | null }> {
  const { data: settings } = await supabase.from('settings').select('agent_pin').single()
  if (!settings?.agent_pin) return { user: null, error: 'ยังไม่ได้ตั้ง PIN กรุณาติดต่อเจ้าของ' }
  if (settings.agent_pin !== pin) return { user: null, error: 'PIN ไม่ถูกต้อง' }

  const user: AppUser = { id: 'agent', role: 'agent', display_name: 'เจ้หลุยส์', auth_type: 'pin' }
  setSession(user)
  return { user, error: null }
}

export function canAccessSettings(user: AppUser | null): boolean {
  return user?.role === 'owner'
}
