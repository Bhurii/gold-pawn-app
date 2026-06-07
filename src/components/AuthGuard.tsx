'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AppUser, clearSession, getSession } from '@/lib/auth'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AppUser | null>(() => getSession())

  useEffect(() => {
    const session = getSession()
    setUser(session)
    if (!session && pathname !== '/login') {
      router.replace('/login')
    }
  }, [pathname, router])

  function handleLogout() {
    clearSession()
    setUser(null)
    router.replace('/login')
  }

  if (pathname === '/login') return <>{children}</>
  if (!user) return null

  return (
    <>
      <button
        onClick={handleLogout}
        style={{
          position: 'fixed',
          top: 14,
          right: 14,
          zIndex: 300,
          border: '1px solid var(--danger-border)',
          background: 'rgba(8,8,8,0.92)',
          color: 'var(--danger-soft)',
          borderRadius: 999,
          padding: '10px 14px',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
        }}
      >
        ออกจากระบบ
      </button>
      {children}
    </>
  )
}
