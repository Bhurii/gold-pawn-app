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

  const pawnId = (new URL(request.url).searchParams.get('pawn_id') || '').trim()
  const supabase = createAdminClient()

  let query = supabase
    .from('interest_payments')
    .select('id, pawn_id, payment_date, amount, slip_url, note')
    .order('payment_date')

  if (pawnId) {
    query = query.eq('pawn_id', pawnId)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ payments: data || [] })
}
