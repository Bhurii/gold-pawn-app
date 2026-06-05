import { createClient } from '@supabase/supabase-js'
import { requirePublicEnv } from './env'

const supabaseUrl = requirePublicEnv('NEXT_PUBLIC_SUPABASE_URL')
const supabaseKey = requirePublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

export const supabase = createClient(supabaseUrl, supabaseKey)
