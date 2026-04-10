'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toThaiDateShort, fmt } from '@/lib/utils'

export default function PawnDetail() {
  const router = useRouter()
  const { id } = useParams()
  const [pawn, setPawn] = useState<any>(null)
  const [interests, setInterests] = useState<any[]>([])
  const [redemption, setRedemption] = useState<any>(null)
  const [transferSlips, setTransferSlips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [viewImg, setViewImg] = useState('')
  const [showAddSlip, setShowAddSlip] = useState(false)
  const [slipImage, setSlipImage] = useState<File | null>(null)
  const [slipPreview, setSlipPreview] = useState('')
  const [slipDirection, setSlipDirection] = useState<'me_to_mom' | 'mom_to_me'>('me_to_mom')
  const [slipAmount, setSlipAmount] = useState('')
  const [savingSlip, setSavingSlip] = useState(false)

  useEffect(() => { if (id) loadData() }, [id])

  async function loadData() {
    const { data: p } = await supabase.from('pawns').select('*').eq('id', id).single()
    if (p) setPawn(p)
    const { data: i } = await supabase.from('interest_payments').select('*').eq('pawn_id', id).order('payment_date')
    if (i) setInterests(i)
    const { data: r } = await supabase.from('redemptions').select('*').eq('pawn_id', id).single()
    if (r) setRedemption(r)
    const { data: t } = await supabase.from('transfer_slips').select('*').eq('pawn_id', id).order('created_at')
    if (t) setTransferSlips(t)
    setLoading(false)
  }

  async function handleAddSlip() {
    if (!slipImage) { alert('กรุณาเลือกรูปสลิป'); return }
    setSavingSlip(true)
    try {
      const path = `transfer/${Date.now()}.${slipImage.name.split('.').pop()}`
      const { error } = await supabase.storage.from('slips').upload(path, slipImage)
      if (error) throw error
      const { data } = supabase.storage.from('slips').getPublicUrl(path)
      await supabase.from('transfer_slips').insert({
        pawn_id: id,
        direction: slipDirection,
        slip_url: data.publicUrl,
        amount: slipAmount ? parseFloat(slipAmount) : null,
        confirmed_at: new Date().toISOString()
      })
      setShowAddSlip(false)
      setSlipImage(null)
      setSlipPreview('')
      setSlipAmount('')
      loadData()
      alert('บันทึกสลิปสำเร็จ!')
    } catch (e: any) {
      alert('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setSavingSlip(false)
    }
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--gold)', fontSize: 18 }}>กำลังโหลด...</div>
  if (!pawn) return <div style={{ padding: 40, color: 'var(--text-muted)', textAlign: 'center' }}>ไม่พบข้อมูล</div>

  const totalInterest = interests.reduce((s, i) => s + i.amount, 0)

  return (
    <main className="page-container">
      {viewImg && (
        <div onClick={() => setViewImg('')} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <img src={viewImg} alt="slip" style={{ maxWidth: '100%', maxHeight: '90dvh', borderRadius: 12, objectFit: 'contain' }} />
          <button onClick={() => setViewImg('')} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 99, width: 44, height: 44, fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <div style={{ padding: '56px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 26, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 22, fontWeight: 800 }}>ตั๋ว #{pawn.ticket_no}</div>
        <span className={pawn.status === 'active' ? 'badge-active' : 'badge-redeemed'} style={{ marginLeft: 'auto' }}>
          {pawn.status === 'active' ? 'จำนำอยู่' : 'ไถ่ถอนแล้ว'}
        </span>
      </div>

      {/* ข้อมูลหลัก */}
      <div style={{ background: 'linear-gradient(135deg,#180F00,#2C1A00)', border: '1px solid rgba(242,201,76,0.35)', borderRadius: 20, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>วันที่จำนำ</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{toThaiDateShort(pawn.pawn_date)}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>จำนวนเงิน</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--gold)' }}>฿{fmt(pawn.amount)}</div>
          </div>
        </div>
        {pawn.notes && <div style={{ marginTop: 12, fontSize: 14, color: 'var(--text-secondary)' }}>{pawn.notes}</div>}
      </div>

      {/* รูปตั๋วจำนำ */}
      {pawn.pawn_slip_url && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>📄 รูปตั๋วจำนำ</div>
          <img src={pawn.pawn_slip_url} onClick={() => setViewImg(pawn.pawn_slip_url)}
            style={{ width: '100%', borderRadius: 12, maxHeight: 220, objectFit: 'contain', cursor: 'pointer', background: 'var(--black-700)' }} alt="pawn slip" />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>แตะรูปเพื่อขยาย</div>
        </div>
      )}

      {/* สลิปโอนเงิน */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>💸 สลิปโอนเงิน</div>
          <button onClick={() => setShowAddSlip(!showAddSlip)}
            style={{ background: 'linear-gradient(135deg,#C9922A,#F2C94C)', color: '#080808', border: 'none', borderRadius: 10, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            + เพิ่มสลิป
          </button>
        </div>

        {showAddSlip && (
          <div style={{ background: 'var(--black-700)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>เพิ่มสลิปโอนเงิน</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {(['me_to_mom', 'mom_to_me'] as const).map(d => (
                <button key={d} onClick={() => setSlipDirection(d)}
                  style={{ padding: '10px', borderRadius: 10, border: '1px solid', cursor: 'pointer', fontSize: 13, fontWeight: 600, borderColor: slipDirection === d ? 'var(--gold)' : 'var(--border)', background: slipDirection === d ? 'rgba(242,201,76,0.15)' : 'transparent', color: slipDirection === d ? 'var(--gold)' : 'var(--text-muted)' }}>
                  {d === 'me_to_mom' ? '💸 ฉันโอนให้แม่' : '💰 แม่โอนให้ฉัน'}
                </button>
              ))}
            </div>
            <input className="input-field" type="number" placeholder="จำนวนเงิน (บาท)" value={slipAmount} onChange={e => setSlipAmount(e.target.value)} style={{ marginBottom: 10 }} />
            {slipPreview ? (
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <img src={slipPreview} onClick={() => setViewImg(slipPreview)} style={{ width: '100%', borderRadius: 10, maxHeight: 160, objectFit: 'contain', background: 'var(--black-800)', cursor: 'pointer' }} alt="slip" />
                <button onClick={() => { setSlipPreview(''); setSlipImage(null) }} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: 99, width: 28, height: 28, cursor: 'pointer', fontSize: 14 }}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 12, padding: '12px', cursor: 'pointer' }}>
                  <input type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) { setSlipImage(f); setSlipPreview(URL.createObjectURL(f)) } }} style={{ display: 'none' }} />
                  <span style={{ fontSize: 24 }}>📷</span>
                  <span style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>ถ่ายรูป</span>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 12, padding: '12px', cursor: 'pointer' }}>
                  <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setSlipImage(f); setSlipPreview(URL.createObjectURL(f)) } }} style={{ display: 'none' }} />
                  <span style={{ fontSize: 24 }}>🖼️</span>
                  <span style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>เลือกจากคลัง</span>
                </label>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="btn-secondary" onClick={() => { setShowAddSlip(false); setSlipPreview(''); setSlipImage(null) }} style={{ fontSize: 15 }}>ยกเลิก</button>
              <button className="btn-primary" onClick={handleAddSlip} disabled={savingSlip} style={{ fontSize: 15 }}>
                {savingSlip ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        )}

        {transferSlips.length === 0 && !showAddSlip ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 15, textAlign: 'center', padding: '8px 0' }}>ยังไม่มีสลิปโอนเงิน</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {transferSlips.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {t.slip_url && (
                  <img src={t.slip_url} onClick={() => setViewImg(t.slip_url)}
                    style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', cursor: 'pointer', flexShrink: 0, background: 'var(--black-700)' }} alt="transfer" />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>
                    {t.direction === 'me_to_mom' ? '💸 ฉันโอนให้แม่' : '💰 แม่โอนให้ฉัน'}
                  </div>
                  {t.amount && <div style={{ fontSize: 16, color: 'var(--gold)', fontWeight: 700 }}>฿{fmt(t.amount)}</div>}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{toThaiDateShort(t.created_at?.split('T')[0])}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ประวัติตัดดอก */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>✂️ ประวัติตัดดอก</div>
          {pawn.status === 'active' && (
            <button onClick={() => router.push(`/interest?pawn_id=${id}`)}
              style={{ background: 'linear-gradient(135deg,#C9922A,#F2C94C)', color: '#080808', border: 'none', borderRadius: 10, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              + ตัดดอก
            </button>
          )}
        </div>
        {interests.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 15, textAlign: 'center', padding: '8px 0' }}>ยังไม่มีการตัดดอก</div>
        ) : (
          <>
            {interests.map((int, i) => (
              <div key={int.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < interests.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                {int.slip_url ? (
                  <img src={int.slip_url} onClick={() => setViewImg(int.slip_url)}
                    style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', cursor: 'pointer', flexShrink: 0 }} alt="interest slip" />
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: 8, background: 'var(--black-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>✂️</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>ครั้งที่ {i + 1}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{toThaiDateShort(int.payment_date)}</div>
                  {int.note && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{int.note}</div>}
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#6fcf6f' }}>+฿{fmt(int.amount)}</div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid rgba(242,201,76,0.2)', marginTop: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>ดอกรวมที่ตัดแล้ว</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold)' }}>฿{fmt(totalInterest)}</div>
            </div>
          </>
        )}
      </div>

      {/* ข้อมูลไถ่ถอน */}
      {redemption && (
        <div className="card" style={{ marginBottom: 16, border: '1px solid rgba(240,149,149,0.3)' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: '#f09595' }}>📤 ข้อมูลไถ่ถอน</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 15 }}>วันที่ไถ่ถอน</span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{toThaiDateShort(redemption.redeem_date)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 15 }}>ดอกเบี้ยรวม</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#6fcf6f' }}>+฿{fmt(redemption.interest_total)}</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {redemption.pawn_slip_url && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>ตั๋วไถ่ถอน</div>
                <img src={redemption.pawn_slip_url} onClick={() => setViewImg(redemption.pawn_slip_url)}
                  style={{ width: '100%', height: 80, borderRadius: 10, objectFit: 'cover', cursor: 'pointer', background: 'var(--black-700)' }} alt="redeem pawn" />
              </div>
            )}
            {redemption.transfer_slip_url && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>สลิปโอนเงิน</div>
                <img src={redemption.transfer_slip_url} onClick={() => setViewImg(redemption.transfer_slip_url)}
                  style={{ width: '100%', height: 80, borderRadius: 10, objectFit: 'cover', cursor: 'pointer', background: 'var(--black-700)' }} alt="redeem transfer" />
              </div>
            )}
          </div>
        </div>
      )}

      {pawn.status === 'active' && (
        <button className="btn-primary" onClick={() => router.push(`/redeem?pawn_id=${id}`)} style={{ fontSize: 18 }}>
          📤 ไถ่ถอนตั๋วนี้
        </button>
      )}
      <div style={{ height: 32 }} />
    </main>
  )
}
