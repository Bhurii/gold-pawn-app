'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { toThaiDateLong, fmt } from '@/lib/utils'

export default function ConfirmRedeem() {
  const router = useRouter()
  const { id } = useParams()
  const user = getSession()
  const [redemption, setRedemption] = useState<any>(null)
  const [pawn, setPawn] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [viewImg, setViewImg] = useState('')

  useEffect(() => {
    if (user?.role !== 'owner') { router.replace('/'); return }
    loadData()
  }, [])

  async function loadData() {
    const { data: r } = await supabase.from('redemptions').select('*').eq('id', id).single()
    if (r) {
      setRedemption(r)
      const { data: p } = await supabase.from('pawns').select('*').eq('id', r.pawn_id).single()
      if (p) setPawn(p)
    }
    setLoading(false)
  }

  async function handleConfirm() {
    setConfirming(true)
    try {
      await supabase.from('redemptions').update({ status: 'confirmed' }).eq('id', id)
      await supabase.from('pawns').update({ status: 'redeemed', tx_status: 'redeemed' }).eq('id', redemption.pawn_id)
      await supabase.from('notifications').insert({
        type: 'redeem_confirmed',
        message: `ยืนยันแล้ว! ห่านตั๋ว #${pawn?.ticket_no} กลับบ้านแล้ว ✅`,
        pawn_id: redemption.pawn_id
      })
      alert('ยืนยันสำเร็จ! ห่านกลับบ้านแล้ว 🐣✅')
      router.replace('/')
    } catch (e: any) {
      alert('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setConfirming(false)
    }
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--gold)', fontSize: 18 }}>กำลังโหลด...</div>

  return (
    <main className="page-container">
      {viewImg && (
        <div onClick={() => setViewImg('')} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.97)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <img src={viewImg} style={{ maxWidth: '100%', maxHeight: '90dvh', borderRadius: 12, objectFit: 'contain' }} alt="preview" />
          <button onClick={() => setViewImg('')} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 99, width: 44, height: 44, fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <div style={{ padding: '56px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 26, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 22, fontWeight: 800 }}>🐣 ยืนยันขายห่าน</div>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'var(--gold)' }} />
        <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'var(--gold)' }} />
        <div style={{ fontSize: 12, color: 'var(--gold)', marginLeft: 4 }}>Step 2/2</div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
        ตรวจสอบข้อมูลแล้วกดยืนยัน
      </div>

      <div style={{ background: 'linear-gradient(135deg,#180F00,#2C1A00)', border: '1px solid rgba(242,201,76,0.35)', borderRadius: 20, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>ตั๋ว #{pawn?.ticket_no}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)', marginBottom: 4 }}>฿{fmt(pawn?.amount || 0)}</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>วันที่คืน: {toThaiDateLong(redemption?.redeem_date)}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>
          <span>ไข่รวมทั้งหมด</span>
          <span style={{ color: '#6fcf6f', fontWeight: 700 }}>+฿{fmt(redemption?.interest_total || 0)}</span>
        </div>
      </div>

      {/* รูปหลักฐาน */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>📎 หลักฐานจากเจ้หลุย</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {redemption?.pawn_slip_url ? (
            <div onClick={() => setViewImg(redemption.pawn_slip_url)} style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>ตั๋วจำนำ</div>
              <div style={{ position: 'relative' }}>
                <img src={redemption.pawn_slip_url} style={{ width: '100%', height: 100, borderRadius: 10, objectFit: 'cover', background: 'var(--black-700)' }} alt="pawn" />
                <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔍</div>
              </div>
            </div>
          ) : <div style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center' }}>ไม่มีรูปตั๋ว</div>}
          {redemption?.transfer_slip_url ? (
            <div onClick={() => setViewImg(redemption.transfer_slip_url)} style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>สลิปโอนเงิน</div>
              <div style={{ position: 'relative' }}>
                <img src={redemption.transfer_slip_url} style={{ width: '100%', height: 100, borderRadius: 10, objectFit: 'cover', background: 'var(--black-700)' }} alt="transfer" />
                <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔍</div>
              </div>
            </div>
          ) : <div style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center' }}>ไม่มีสลิป</div>}
        </div>
      </div>

      <button className="btn-primary" onClick={handleConfirm} disabled={confirming} style={{ fontSize: 18, marginBottom: 12 }}>
        {confirming ? 'กำลังยืนยัน...' : '✅ ยืนยัน ห่านกลับบ้านแล้ว'}
      </button>
      <button onClick={() => router.back()} className="btn-secondary" style={{ fontSize: 16 }}>
        ยังไม่ยืนยัน
      </button>
      <div style={{ height: 32 }} />
    </main>
  )
}
