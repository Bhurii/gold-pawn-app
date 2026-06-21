import type { FundOwnerKey } from '@/lib/fund-owner'
import type { SessionUser } from '@/lib/server/app-session'

export type NotificationRecipient = FundOwnerKey | 'all'

const RECIPIENTS_PARAM = 'notify_to'

function toUrl(actionUrl: string) {
  return new URL(actionUrl, 'https://haanthong.local')
}

export function createNotificationAction(actionUrl: string, recipients: NotificationRecipient[] = ['all']) {
  const url = toUrl(actionUrl)
  const uniqueRecipients = [...new Set(recipients)]
  url.searchParams.set(RECIPIENTS_PARAM, uniqueRecipients.join(','))
  return `${url.pathname}${url.search}${url.hash}`
}

export function parseNotificationAction(actionUrl?: string | null): {
  url: string
  recipients: NotificationRecipient[]
} {
  if (!actionUrl) {
    return {
      url: '/',
      recipients: ['all'] as NotificationRecipient[],
    }
  }

  const url = toUrl(actionUrl)
  const recipients = (url.searchParams.get(RECIPIENTS_PARAM) || 'all')
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is NotificationRecipient => value === 'all' || value === 'tony' || value === 'louise' || value === 'phat')

  url.searchParams.delete(RECIPIENTS_PARAM)

  return {
    url: `${url.pathname}${url.search}${url.hash}` || '/',
    recipients: recipients.length > 0 ? recipients : ['all'],
  }
}

export function canReceiveNotification(
  recipients: NotificationRecipient[],
  user?: Pick<SessionUser, 'user_key'> | null,
) {
  return recipients.includes('all') || (!!user?.user_key && recipients.includes(user.user_key))
}
