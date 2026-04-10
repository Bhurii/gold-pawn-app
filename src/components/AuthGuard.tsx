'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getSession, AppUser } from '@/lib/auth'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AppUser | null | undefined>(undefined)

  useEffect(() => {
    const session = getSession()
    if (!session && pathname !== '/login') {
      router.replace('/login')
    } else {
      setUser(session)
    }
  }, [pathname])

  if (pathname === '/login') return <>{children}</>
  if (user === undefined) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--gold)', fontSize: 18 }}>
      กำลังโหลด...
    </div>
  )
  if (!user) return null
  return <>{children}</>
}
