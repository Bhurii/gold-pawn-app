'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

type LoanRow = {
  id: string
  borrower_name: string
  start_date: string
  interest_rate: number
  remaining_principal: number
  status: 'active' | 'closed'
}

export default function LoanList() {
  const router = useRouter()
  const [loans, setLoans] = useState<LoanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all')

  useEffect(() => {
    void loadLoans()
  }, [filter])

  async function loadLoans() {
    setLoading(true)

    let query = supabase
      .from('loans')
      .select('id, borrower_name, start_date, interest_rate, remaining_principal, status')
      .order('created_at', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data } = await query
    setLoans((data || []) as LoanRow[])
    setLoading(false)
  }

  const fmt = (value: number) => value.toLocaleString('th-TH')

  return (
    <main className="page-container">
      <div style={{ padding: '56px 0 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 26, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gold)' }}>สินเชื่อ</div>
        <button onClick={() => router.push('/loans/new')} style={{ marginLeft: 'auto', background: 'linear-gradient(135deg,#C9922A,#F2C94C)', color: '#080808', border: 'none', borderRadius: 12, padding: '8px 18px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          + ใหม่
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'active', 'closed'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            style={{
              padding: '8px 18px',
              borderRadius: 99,
              fontSize: 14,
              fontWeight: 600,
              border: '1px solid',
              cursor: 'pointer',
              borderColor: filter === value ? 'var(--gold)' : 'var(--border)',
              background: filter === value ? 'rgba(242,201,76,0.15)' : 'transparent',
              color: filter === value ? 'var(--gold)' : 'var(--text-muted)',
            }}
          >
            {value === 'all' ? 'ทั้งหมด' : value === 'active' ? 'ค้างอยู่' : 'ปิดแล้ว'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--gold)', padding: 40, fontSize: 18 }}>กำลังโหลด...</div>
      ) : loans.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40, fontSize: 16 }}>ไม่มีรายการ</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loans.map((loan) => (
            <div key={loan.id} className="card" onClick={() => router.push(`/loans/${loan.id}`)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(242,201,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>👤</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{loan.borrower_name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>เริ่ม {new Date(loan.start_date).toLocaleDateString('th-TH')}</div>
                {loan.interest_rate > 0 && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>ดอก {loan.interest_rate}%/เดือน</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--gold)' }}>฿{fmt(loan.remaining_principal)}</div>
                <span className={loan.status === 'active' ? 'badge-active' : 'badge-closed'}>
                  {loan.status === 'active' ? 'ค้างอยู่' : 'ปิดแล้ว'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </main>
  )
}
