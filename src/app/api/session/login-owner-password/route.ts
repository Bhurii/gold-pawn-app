import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requirePublicEnv } from '@/lib/env'
import { applySessionCookie } from '@/lib/server/app-session'
import { createAdminClient } from '@/lib/server/admin'
import { hitRateLimit } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getClientKey(request: NextRequest) {
  return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'local'
}

export async function POST(request: NextRequest) {
  try {
    const limiter = hitRateLimit(`login-owner-password:${getClientKey(request)}`, 8, 10 * 60 * 1000)
    if (!limiter.allowed) {
      return NextResponse.json({ error: 'ลองใหม่อีกครั้งในภายหลัง' }, { status: 429 })
    }

    const body = await request.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!email || !password) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
    }

    const supabase = createClient(
      requirePublicEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requirePublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      return NextResponse.json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
    }

    const admin = createAdminClient()

    const { data: roleRecord, error: roleError } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', data.user.id)
      .maybeSingle()

    if (roleError) {
      throw roleError
    }

    if (!roleRecord || roleRecord.role !== 'owner') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าใช้งาน' }, { status: 403 })
    }

    const user = {
      id: data.user.id,
      role: 'owner' as const,
      display_name: 'โทนี่',
      auth_type: 'email' as const,
    }

    const response = NextResponse.json({ user })
    applySessionCookie(response, user)
    return response
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
