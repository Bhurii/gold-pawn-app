'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/', label: 'หน้าแรก', icon: '🐣' },
  { href: '/pawns', label: 'ตั๋วจำนำ', icon: '📋' },
  { href: '/loans', label: 'สินเชื่อ', icon: '🍊' },
  { href: '/report', label: 'รายงาน', icon: '📊' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
        return (
          <Link key={item.href} href={item.href} className={`nav-item${active ? ' active' : ''}`}>
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
