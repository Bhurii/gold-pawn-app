import { cookies } from 'next/headers'
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/server/app-session'

export async function readPageSession() {
  const cookieStore = await cookies()
  return decodeSession(cookieStore.get(SESSION_COOKIE_NAME)?.value)
}
