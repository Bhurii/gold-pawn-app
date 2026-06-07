import { supabase } from './supabase'

export type UserRole = 'owner' | 'agent' | null

export interface AppUser {
  id: string
  role: UserRole
  display_name: string
  auth_type: 'email' | 'pin'
}

const SESSION_KEY = 'haantong_user'
const OWNER_PIN_TYPE = 'owner_pin_config'

function isAppUser(value: unknown): value is AppUser {
  if (!value || typeof value !== 'object') return false
  const user = value as Partial<AppUser>
  return typeof user.id === 'string'
    && (user.role === 'owner' || user.role === 'agent')
    && typeof user.display_name === 'string'
    && (user.auth_type === 'email' || user.auth_type === 'pin')
}

type OwnerPinRecord = {
  pin: string
  updatedAt: string
}

async function readOwnerPinRecord(): Promise<OwnerPinRecord | null> {
  const { data: settings } = await supabase.from('settings').select('owner_pin').single()
  if (settings?.owner_pin) {
    return {
      pin: settings.owner_pin,
      updatedAt: new Date().toISOString(),
    }
  }

  const { data } = await supabase
    .from('notifications')
    .select('message')
    .eq('type', OWNER_PIN_TYPE)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.message) return null

  try {
    const parsed = JSON.parse(data.message) as OwnerPinRecord
    return typeof parsed.pin === 'string' ? parsed : null
  } catch {
    return null
  }
}

export async function saveOwnerPin(pin: string) {
  const payload: OwnerPinRecord = {
    pin,
    updatedAt: new Date().toISOString(),
  }

  const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .eq('type', OWNER_PIN_TYPE)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase
      .from('notifications')
      .update({ message: JSON.stringify(payload), is_read: true })
      .eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('notifications').insert({
    type: OWNER_PIN_TYPE,
    message: JSON.stringify(payload),
    is_read: true,
  })
  if (error) throw error
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
  const record = await readOwnerPinRecord()
  return Boolean(record?.pin)
}

export async function getOwnerPinValue(): Promise<string> {
  const record = await readOwnerPinRecord()
  return record?.pin || ''
}

export async function loginOwnerWithPin(pin: string): Promise<{ user: AppUser | null, error: string | null }> {
  const record = await readOwnerPinRecord()
  if (!record?.pin) {
    return { user: null, error: 'ยังไม่ได้ตั้ง PIN โทนี่ กรุณาเข้าแบบเดิมก่อน แล้วค่อยไปตั้งในหน้าตั้งค่า' }
  }
  if (record.pin !== pin) {
    return { user: null, error: 'PIN โทนี่ไม่ถูกต้อง' }
  }

  const user: AppUser = { id: 'owner', role: 'owner', display_name: 'โทนี่', auth_type: 'pin' }
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
    display_name: 'โทนี่',
    auth_type: 'email',
  }
  setSession(user)
  return { user, error: null }
}

export async function loginAgent(pin: string): Promise<{ user: AppUser | null, error: string | null }> {
  const { data: settings } = await supabase.from('settings').select('agent_pin').single()
  if (!settings?.agent_pin) return { user: null, error: 'ยังไม่ได้ตั้ง PIN กรุณาติดต่อโทนี่' }
  if (settings.agent_pin !== pin) return { user: null, error: 'PIN ไม่ถูกต้อง' }

  const user: AppUser = { id: 'agent', role: 'agent', display_name: 'เจ้หลุยส์', auth_type: 'pin' }
  setSession(user)
  return { user, error: null }
}

export function canAccessSettings(user: AppUser | null): boolean {
  return user?.role === 'owner' || user?.role === 'agent'
}

export function isAdmin(user: AppUser | null): boolean {
  return user?.role === 'owner'
}
