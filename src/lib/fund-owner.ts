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

export const FUND_OWNER_BADGE_STYLES: Record<FundOwnerKey, { background: string; color: string; border: string }> = {
  tony: {
    background: 'rgba(242,201,76,0.12)',
    color: 'var(--gold-light)',
    border: '1px solid rgba(242,201,76,0.28)',
  },
  louise: {
    background: 'rgba(124,89,217,0.14)',
    color: '#D9CCFF',
    border: '1px solid rgba(168,135,255,0.32)',
  },
  phat: {
    background: 'rgba(72,156,120,0.14)',
    color: '#BFEFD4',
    border: '1px solid rgba(100,209,157,0.28)',
  },
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
  return user.user_key
}

export function getNotificationRecipientsForFundOwner(owner: FundOwnerKey) {
  return owner === 'louise' ? ['louise'] as const : [owner, 'louise'] as const
}

export function getFundOwnerLabel(owner: FundOwnerKey) {
  return FUND_OWNER_LABELS[owner]
}

export function getOwnerScopeOptions(user?: Pick<AppUser, 'user_key'> | null) {
  const mine = user?.user_key && isFundOwnerKey(user.user_key) ? user.user_key : 'tony'
  const owners = getAccessibleFundOwners(user)

  return [
    { value: mine, label: 'ของฉัน' },
    ...owners.filter((owner) => owner !== mine).map((owner) => ({ value: owner, label: FUND_OWNER_LABELS[owner] })),
    ...(canViewAllFunds(user) ? [{ value: 'all' as const, label: 'ทั้งหมด' }] : []),
  ]
}
