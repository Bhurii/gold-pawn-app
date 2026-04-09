'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PawnDetail() {
  const router = useRouter()
  const { id } = useParams()
  const [pawn, setPawn] = useState<any>(null)
  const [interests, setInterests] = useState<any[]>([])
  const [redemption, setRedemption] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (id) loadData() }, [id])

  async function loadData() {
    const { data: p } = await supabase.from('pawns').select('*').eq('id', id).single()
    if (p) setPawn(p)
    const { data: i } = await supabase.from('interest_payments').select('*').eq('pawn_id', id).order('payment_date')
    if (i) setInterests(i)
    const { data: r } = await supabase.from('redemptions').select('*').eq('pawn_id', id).single()
    if (r) setRedemption(r)
    setLoading(false)
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--gold)', fontSize: 18 }}>กำลังโหลด...</div>
  if (!pawn) return <div style={{ padding: 40, color: 'var(--text-muted)', textAlign: 'center' }}>ไม่พบข้อมูล</div>

  const totalInterest = interests.reduce((s, i) => s + i.amount, 0)
  const fmt = (n: number) => n.toLocaleString('th-TH')

  return (
    <main className="page-container">
      <div style={{ padding: '56px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 26, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 22, fontWeight: 800 }}>ตั๋ว #{pawn.ticket_no}</div>
        <span className={pawn.status === 'active' ? 'badge-active' : 'badge-redeemed'} style={{ marginLeft: 'auto' }}>
          {pawn.status === 'active' ? 'จำนำอยู่' : 'ไถ่ถอนแล้ว'}
        </span>
      </div>

      {/* ข้อมูลหลัก */}
      <div style={{ background: 'linear-gradient(135deg,#1A1200,#2A1F00)', border: '1px solid rgba(240,192,64,0.3)', borderRadius: 20, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>วันที่จำนำ</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{new Date(pawn.pawn_date).toLocaleDateString('th-TH')}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>จำนวนเงิน</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--gold)' }}>฿{fmt(pawn.amount)}</div>
          </div>
        </div>
        {pawn.notes && <div style={{ marginTop: 12, fontSize: 15, color: 'var(--text-secondary)' }}>{pawn.notes}</div>}
      </div>

      {/* รูปตั๋ว */}
      {pawn.pawn_slip_url && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600 }}>รูปตั๋วจำนำ</div>
          <img src={pawn.pawn_slip_url} alt="slip" style={{ width: '100%', borderRadius: 12, maxHeight: 220, objectFit: 'contain' }} />
        </div>
      )}

      {/* ประวัติตัดดอก */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>ประวัติตัดดอก</div>
          {pawn.status === 'active' && (
            <button onClick={() => router.push(`/interest?pawn_id=${id}`)}
              style={{ background: 'linear-gradient(135deg,#B8860B,#F0C040)', color: '#0A0A0A', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              + ตัดดอก
            </button>
          )}
        </div>
        {interests.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 15, textAlign: 'center', padding: '12px 0' }}>ยังไม่มีการตัดดอก</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {interests.map((int, i) => (
              <div key={int.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < interests.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>ครั้งที่ {i + 1}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(int.payment_date).toLocaleDateString('th-TH')}</div>
                  {int.note && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{int.note}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#6fcf6f' }}>+฿{fmt(int.amount)}</div>
                  {int.slip_url && <a href={int.slip_url} target="_blank" style={{ fontSize: 12, color: 'var(--gold)' }}>ดูสลิป</a>}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid rgba(240,192,64,0.2)' }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>ดอกรวมที่ตัดแล้ว</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold)' }}>฿{fmt(totalInterest)}</div>
            </div>
          </div>
        )}
      </div>

      {/* ข้อมูลไถ่ถอน */}
      {redemption && (
        <div className="card" style={{ marginBottom: 16, border: '1px solid rgba(240,149,149,0.3)' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: '#f09595' }}>ข้อมูลไถ่ถอน</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 15 }}>วันที่ไถ่ถอน</span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{new Date(redemption.redeem_date).toLocaleDateString('th-TH')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 15 }}>ดอกเบี้ยรวม</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#6fcf6f' }}>+฿{fmt(redemption.interest_total)}</span>
          </div>
        </div>
      )}

      {pawn.status === 'active' && (
        <button className="btn-primary" onClick={() => router.push(`/redeem?pawn_id=${id}`)}>
          📤 ไถ่ถอนตั๋วนี้
        </button>
      )}
      <div style={{ height: 32 }} />
    </main>
  )
}
