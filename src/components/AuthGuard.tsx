'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getSession, clearSession, AppUser } from '@/lib/auth'

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
  }, [pathname, router])

  function handleLogout() {
    clearSession()
    setUser(null)
    router.replace('/login')
  }

  if (pathname === '/login') return <>{children}</>
  if (user === undefined) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--gold)', fontSize: 18 }}>
      กำลังโหลด...
    </div>
  )
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
          border: '1px solid rgba(240,149,149,0.35)',
          background: 'rgba(8,8,8,0.92)',
          color: '#f09595',
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
