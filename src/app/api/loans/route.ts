import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/admin'
import { readSessionFromRequest } from '@/lib/server/app-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const filter = new URL(request.url).searchParams.get('filter') || 'all'
  const supabase = createAdminClient()

  let query = supabase
    .from('loans')
    .select('id, borrower_name, start_date, interest_rate, remaining_principal, status')
    .order('created_at', { ascending: false })

  if (filter === 'active' || filter === 'closed') {
    query = query.eq('status', filter)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ loans: data || [] })
}
