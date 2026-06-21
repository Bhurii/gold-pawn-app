import type { AppUser } from '@/lib/auth'

export type FundOwnerKey = 'tony' | 'louise' | 'phat'
export type UserRole = 'owner' | 'agent' | 'viewer'

export const FUND_OWNER_LABELS: Record<FundOwnerKey, string> = {
  tony: 'โทนี่',
  louise: 'เจ้หลุยส์',
  phat: 'เจ้ภัส',
}

export const FUND_OWNER_BADGES: Record<FundOwnerKey, string> = {
  tony: 'ทุนโทนี่',
  louise: 'ทุนเจ้หลุยส์',
  phat: 'ทุนเจ้ภัส',
}

export function isFundOwnerKey(value: string | null | undefined): value is FundOwnerKey {
  return value === 'tony' || value === 'louise' || value === 'phat'
}

export function getReadableUserName(user?: Pick<AppUser, 'display_name'> | null) {
  return user?.display_name || 'ผู้ใช้'
}

export function getAccessibleFundOwners(user?: Pick<AppUser, 'user_key'> | null): FundOwnerKey[] {
  if (!user) return ['tony']
  if (user.user_key === 'louise' || user.user_key === 'tony') {
    return ['tony', 'louise', 'phat']
  }
  return ['phat']
}

export function canViewAllFunds(user?: Pick<AppUser, 'user_key'> | null) {
  return user?.user_key === 'tony' || user?.user_key === 'louise'
}

export function getDefaultFundOwner(user?: Pick<AppUser, 'user_key'> | null): FundOwnerKey {
  if (!user) return 'tony'
  return user.user_key
}

export function getDefaultFundScope(user?: Pick<AppUser, 'user_key'> | null): FundOwnerKey | 'all' {
  if (!user) return 'tony'
  if (user.user_key === 'louise') return 'all'
  return user.user_key
}

export function getNotificationRecipientsForFundOwner(owner: FundOwnerKey) {
  return owner === 'louise' ? ['louise'] as const : [owner, 'louise'] as const
}

export function getFundOwnerLabel(owner: FundOwnerKey) {
  return FUND_OWNER_LABELS[owner]
}
