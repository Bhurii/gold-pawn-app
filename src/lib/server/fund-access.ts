import type { PostgrestFilterBuilder } from '@supabase/postgrest-js'
import type { FundOwnerKey } from '@/lib/fund-owner'
import { canViewAllFunds, getAccessibleFundOwners, getDefaultFundScope, isFundOwnerKey } from '@/lib/fund-owner'
import type { SessionUser } from '@/lib/server/app-session'

export type FundScope = FundOwnerKey | 'all'

export function resolveFundScope(user: SessionUser, requested: string | null): FundScope {
  if (requested === 'all' && canViewAllFunds(user)) return 'all'
  if (isFundOwnerKey(requested) && getAccessibleFundOwners(user).includes(requested)) return requested
  return getDefaultFundScope(user)
}

export function canAccessFundOwner(user: SessionUser, owner: string | null | undefined) {
  return Boolean(owner && isFundOwnerKey(owner) && getAccessibleFundOwners(user).includes(owner))
}

export function applyFundScopeFilter<TBuilder extends PostgrestFilterBuilder<any, any, any, any, any>>(
  query: TBuilder,
  scope: FundScope,
  column = 'fund_owner',
) {
  if (scope === 'all') return query
  return query.eq(column, scope)
}
