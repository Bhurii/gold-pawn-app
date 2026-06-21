import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/admin'
import { applyFundScopeFilter, resolveFundScope } from '@/lib/server/fund-access'
import { readSessionFromRequest } from '@/lib/server/app-session'
import { getOrSetMemoryCache } from '@/lib/server/memory-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const filter = new URL(request.url).searchParams.get('filter') || 'all'
  const ownerScope = resolveFundScope(user, new URL(request.url).searchParams.get('owner_scope'))
  try {
    const loans = await getOrSetMemoryCache(`api:loans:${ownerScope}:${filter}`, 20000, async () => {
      const supabase = createAdminClient()

      let query = supabase
        .from('loans')
        .select('id, borrower_name, fund_owner, start_date, interest_rate, remaining_principal, status')
        .order('created_at', { ascending: false })

      query = applyFundScopeFilter(query, ownerScope)

      if (filter === 'active' || filter === 'closed') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    })

    return NextResponse.json({ loans })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load loans' }, { status: 500 })
  }
}
