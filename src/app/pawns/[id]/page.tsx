'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toThaiDateShort, toThaiDateLong, fmt } from '@/lib/utils'

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
      const { error: uploadError } = await supabase.storage.from('slips').upload(path, slipImage)
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('slips').getPublicUrl(path)
      const { error: insertError } = await supabase.from('transfer_slips').insert({
        pawn_id: id,
        direction: slipDirection,
        slip_url: urlData.publicUrl,
        amount: slipAmount ? parseFloat(slipAmount) : null,
        confirmed_at: new Date().toISOString()
      })
      if (insertError) throw insertError
      setShowAddSlip(false)
      setSlipImage(null)
      setSlipPreview('')
      setSlipAmount('')
      await loadData()
      alert('บันทึกสลิปสำเร็จ!')
    } catch (e: any) {
      alert('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setSavingSlip(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--gold)', fontSize: 18 }}>
      กำลังโหลด...
    </div>
  )
  if (!pawn) return (
    <div style={{ padding: 40, color: 'var(--text-muted)', textAlign: 'center' }}>ไม่พบข้อมูล</div>
  )

  const totalInterest = interests.reduce((s, i) => s + i.amount, 0)

  return (
    <main className="page-container">

      {/* Full screen viewer */}
      {viewImg && (
        <div onClick={() => setViewImg('')}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.97)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <img src={viewImg} alt="preview"
            style={{ maxWidth: '100%', maxHeight: '90dvh', borderRadius: 12, objectFit: 'contain' }} />
          <button onClick={() => setViewImg('')}
            style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 99, width: 44, height: 44, fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          <div style={{ position: 'absolute', bottom: 24, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>แตะที่ใดก็ได้เพื่อปิด</div>
        </div>
      )}

      <div style={{ padding: '56px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 26, cursor: 'pointer' }}>←</button>
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
            <div style={{ fontSize: 17, fontWeight: 700 }}>{toThaiDateLong(pawn.pawn_date)}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>จำนวนเงิน</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>฿{fmt(pawn.amount)}</div>
          </div>
        </div>
        {pawn.notes && <div style={{ marginTop: 12, fontSize: 14, color: 'var(--text-secondary)' }}>{pawn.notes}</div>}
      </div>

      {/* รูปตั๋วจำนำ */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📄 ตั๋วจำนำ</div>
        {pawn.pawn_slip_url ? (
          <div onClick={() => setViewImg(pawn.pawn_slip_url)} style={{ cursor: 'pointer', position: 'relative' }}>
            <img src={pawn.pawn_slip_url} alt="pawn slip"
              style={{ width: '100%', borderRadius: 12, maxHeight: 220, objectFit: 'contain', background: 'var(--black-700)', display: 'block' }} />
            <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: '#fff' }}>
              แตะเพื่อขยาย 🔍
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px 0', fontSize: 15 }}>
            ยังไม่มีรูปตั๋ว
          </div>
        )}
      </div>

      {/* สลิปโอนเงิน */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>💸 สลิปโอนเงิน</div>
          {!showAddSlip && (
            <button onClick={() => setShowAddSlip(true)}
              style={{ background: 'linear-gradient(135deg,#C9922A,#F2C94C)', color: '#080808', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              + เพิ่มสลิป
            </button>
          )}
        </div>

        {/* ฟอร์มเพิ่มสลิป */}
        {showAddSlip && (
          <div style={{ background: 'var(--black-700)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>เพิ่มสลิปโอนเงิน</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {(['me_to_mom', 'mom_to_me'] as const).map(d => (
                <button key={d} onClick={() => setSlipDirection(d)}
                  style={{ padding: '12px 8px', borderRadius: 12, border: '1px solid', cursor: 'pointer', fontSize: 14, fontWeight: 600, borderColor: slipDirection === d ? 'var(--gold)' : 'var(--border)', background: slipDirection === d ? 'rgba(242,201,76,0.15)' : 'transparent', color: slipDirection === d ? 'var(--gold)' : 'var(--text-muted)' }}>
                  {d === 'me_to_mom' ? '💸 ฉันโอนให้แม่' : '💰 แม่โอนให้ฉัน'}
                </button>
              ))}
            </div>
            <input className="input-field" type="number" placeholder="จำนวนเงิน (บาท)"
              value={slipAmount} onChange={e => setSlipAmount(e.target.value)}
              style={{ marginBottom: 12 }} />
            {slipPreview ? (
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <img src={slipPreview} onClick={() => setViewImg(slipPreview)}
                  style={{ width: '100%', borderRadius: 12, maxHeight: 180, objectFit: 'contain', background: 'var(--black-800)', cursor: 'pointer', display: 'block' }} alt="preview" />
                <button onClick={() => { setSlipPreview(''); setSlipImage(null) }}
                  style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: 99, width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 12, padding: '14px 8px', cursor: 'pointer', background: 'var(--black-800)' }}>
                  <input type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) { setSlipImage(f); setSlipPreview(URL.createObjectURL(f)) } }} style={{ display: 'none' }} />
                  <span style={{ fontSize: 26 }}>📷</span>
                  <span style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>ถ่ายรูป</span>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 12, padding: '14px 8px', cursor: 'pointer', background: 'var(--black-800)' }}>
                  <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setSlipImage(f); setSlipPreview(URL.createObjectURL(f)) } }} style={{ display: 'none' }} />
                  <span style={{ fontSize: 26 }}>🖼️</span>
                  <span style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>เลือกจากคลัง</span>
                </label>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button className="btn-secondary" onClick={() => { setShowAddSlip(false); setSlipPreview(''); setSlipImage(null) }} style={{ fontSize: 15 }}>ยกเลิก</button>
              <button className="btn-primary" onClick={handleAddSlip} disabled={savingSlip} style={{ fontSize: 15 }}>
                {savingSlip ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        )}

        {/* รายการสลิป */}
        {transferSlips.length === 0 && !showAddSlip ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 15, textAlign: 'center', padding: '8px 0' }}>
            ยังไม่มีสลิปโอนเงิน
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {transferSlips.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
                {t.slip_url ? (
                  <div onClick={() => setViewImg(t.slip_url)} style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                    <img src={t.slip_url} alt="transfer slip"
                      style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover', background: 'var(--black-700)', display: 'block' }} />
                    <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔍</div>
                  </div>
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: 10, background: 'var(--black-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>💸</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>
                    {t.direction === 'me_to_mom' ? '💸 ฉันโอนให้แม่' : '💰 แม่โอนให้ฉัน'}
                  </div>
                  {t.amount && <div style={{ fontSize: 17, color: 'var(--gold)', fontWeight: 700 }}>฿{fmt(t.amount)}</div>}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {toThaiDateShort(t.created_at?.split('T')[0])}
                  </div>
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
              style={{ background: 'linear-gradient(135deg,#C9922A,#F2C94C)', color: '#080808', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
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
                  <div onClick={() => setViewImg(int.slip_url)} style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                    <img src={int.slip_url} alt="interest slip"
                      style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', background: 'var(--black-700)', display: 'block' }} />
                    <div style={{ position: 'absolute', inset: 0, borderRadius: 8, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔍</div>
                  </div>
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: 8, background: 'var(--black-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>✂️</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>ครั้งที่ {i + 1}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{toThaiDateLong(int.payment_date)}</div>
                  {int.note && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{int.note}</div>}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#6fcf6f' }}>+฿{fmt(int.amount)}</div>
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
            <span style={{ fontSize: 15, fontWeight: 600 }}>{toThaiDateLong(redemption.redeem_date)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 15 }}>ดอกเบี้ยรวม</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#6fcf6f' }}>+฿{fmt(redemption.interest_total)}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {redemption.pawn_slip_url && (
              <div onClick={() => setViewImg(redemption.pawn_slip_url)} style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>ตั๋วไถ่ถอน</div>
                <div style={{ position: 'relative' }}>
                  <img src={redemption.pawn_slip_url} alt="redeem pawn"
                    style={{ width: '100%', height: 90, borderRadius: 10, objectFit: 'cover', background: 'var(--black-700)', display: 'block' }} />
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔍</div>
                </div>
              </div>
            )}
            {redemption.transfer_slip_url && (
              <div onClick={() => setViewImg(redemption.transfer_slip_url)} style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>สลิปโอนเงิน</div>
                <div style={{ position: 'relative' }}>
                  <img src={redemption.transfer_slip_url} alt="redeem transfer"
                    style={{ width: '100%', height: 90, borderRadius: 10, objectFit: 'cover', background: 'var(--black-700)', display: 'block' }} />
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔍</div>
                </div>
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
