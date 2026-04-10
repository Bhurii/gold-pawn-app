'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoanList() {
  const router = useRouter()
  const [loans, setLoans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all')

  useEffect(() => { loadLoans() }, [])

  async function loadLoans() {
    const { data } = await supabase.from('loans').select('*').order('created_at', { ascending: false })
    if (data) setLoans(data)
    setLoading(false)
  }

  const filtered = loans.filter(l => filter === 'all' ? true : l.status === filter)
  const fmt = (n: number) => n.toLocaleString('th-TH')

  return (
    <main className="page-container">
      <div style={{ padding: '56px 0 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 26, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gold)' }}>เงินกู้ทั่วไป</div>
        <button onClick={() => router.push('/loans/new')}
          style={{ marginLeft: 'auto', background: 'linear-gradient(135deg,#C9922A,#F2C94C)', color: '#080808', border: 'none', borderRadius: 12, padding: '8px 18px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          + ใหม่
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'active', 'closed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 18px', borderRadius: 99, fontSize: 14, fontWeight: 600, border: '1px solid', cursor: 'pointer', borderColor: filter === f ? 'var(--gold)' : 'var(--border)', background: filter === f ? 'rgba(242,201,76,0.15)' : 'transparent', color: filter === f ? 'var(--gold)' : 'var(--text-muted)' }}>
            {f === 'all' ? 'ทั้งหมด' : f === 'active' ? 'ค้างอยู่' : 'ปิดแล้ว'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--gold)', padding: 40, fontSize: 18 }}>กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40, fontSize: 16 }}>ไม่มีรายการ</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(l => (
            <div key={l.id} className="card" onClick={() => router.push(`/loans/${l.id}`)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(242,201,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>👤</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{l.borrower_name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>เริ่ม {new Date(l.start_date).toLocaleDateString('th-TH')}</div>
                {l.interest_rate > 0 && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>ดอก {l.interest_rate}%/เดือน</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--gold)' }}>฿{fmt(l.remaining_principal)}</div>
                <span className={l.status === 'active' ? 'badge-active' : 'badge-closed'}>
                  {l.status === 'active' ? 'ค้างอยู่' : 'ปิดแล้ว'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <nav className="bottom-nav">
        {[
          { icon: '🪿', label: 'หน้าแรก', href: '/' },
          { icon: '📋', label: 'ตั๋วทอง', href: '/pawns' },
          { icon: '💵', label: 'เงินกู้', href: '/loans', active: true },
          { icon: '📊', label: 'รายงาน', href: '/report' },
        ].map(n => (
          <a key={n.label} href={n.href} className={`nav-item ${n.active ? 'active' : ''}`}>
            <span className="nav-icon">{n.icon}</span>{n.label}
          </a>
        ))}
      </nav>
    </main>
  )
}
