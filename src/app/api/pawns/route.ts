import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/admin'
import { readSessionFromRequest } from '@/lib/server/app-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PawnFilter = 'all' | 'active' | 'redeemed' | 'pending_transfer' | 'pending_confirm'

const VALID_FILTERS = new Set<PawnFilter>(['all', 'active', 'redeemed', 'pending_transfer', 'pending_confirm'])

function normalizeFilter(value: string | null): PawnFilter {
  if (value && VALID_FILTERS.has(value as PawnFilter)) {
    return value as PawnFilter
  }
  return 'all'
}

export async function GET(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const filter = normalizeFilter(url.searchParams.get('filter'))
  const search = (url.searchParams.get('search') || '').trim()
  const id = (url.searchParams.get('id') || '').trim()
  const txStatus = (url.searchParams.get('tx_status') || '').trim()

  const supabase = createAdminClient()

  let query = supabase
    .from('pawns')
    .select('id, ticket_no, pawn_date, amount, status, tx_status, notes, renewed_from_id, renewal_principal_paid, created_at')
    .order('created_at', { ascending: false })

  if (id) {
    query = query.eq('id', id)
  }

  if (filter === 'pending_transfer') {
    query = query.eq('tx_status', 'pending_transfer')
  } else if (filter === 'pending_confirm') {
    query = query.eq('tx_status', 'pending_redeem')
  } else if (filter !== 'all') {
    query = query.eq('status', filter)
  }

  if (txStatus) {
    query = query.eq('tx_status', txStatus)
  }

  if (search) {
    query = query.ilike('ticket_no', `%${search}%`)
  }

  const { data: pawns, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const renewedFromIds = (pawns || []).map((pawn) => pawn.id)
  if (renewedFromIds.length === 0) {
    return NextResponse.json({ pawns: [], adjusted: [] })
  }

  const { data: linked, error: linkedError } = await supabase
    .from('pawns')
    .select('id, renewed_from_id, ticket_no, amount, renewal_principal_paid')
    .in('renewed_from_id', renewedFromIds)

  if (linkedError) {
    return NextResponse.json({ error: linkedError.message }, { status: 500 })
  }

  return NextResponse.json({
    pawns: pawns || [],
    adjusted: linked || [],
  })
}
