import { createClient } from '@supabase/supabase-js'
import { requirePublicEnv } from '@/lib/env'

export function createAdminClient() {
  const supabaseUrl = requirePublicEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || requirePublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
