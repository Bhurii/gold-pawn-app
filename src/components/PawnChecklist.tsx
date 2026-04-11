'use client'
import { useState } from 'react'
import { toThaiDateShort, fmt } from '@/lib/utils'

interface Props {
  pawn: any
  transferSlips: any[]
  interests: any[]
  redemption: any
  onViewImg: (url: string) => void
  onConfirmTransfer: (file: File) => void
  onBypassCash: () => void
  onBypassPrepaid: () => void
  uploadingPawnSlip: boolean
  isOwner: boolean
}

export default function PawnChecklist({ pawn, transferSlips, interests, redemption, onViewImg, onConfirmTransfer, onBypassCash, onBypassPrepaid, uploadingPawnSlip, isOwner }: Props) {
  const [expandTicket, setExpandTicket] = useState(false)
  const [expandTransfer, setExpandTransfer] = useState(false)
  const [expandInterest, setExpandInterest] = useState(false)
  const [expandRedeem, setExpandRedeem] = useState(false)

  const hasTicket = !!pawn.pawn_slip_url
  const hasTransfer = transferSlips.length > 0 || pawn.tx_status === 'active'
  const isPendingTransfer = pawn.tx_status === 'pending_transfer'
  const totalInterest = interests.reduce((s: number, i: any) => s + i.amount, 0)

  function CheckRow({ done, pending, label, expanded, onToggle, children }: any) {
    return (
      <div style={{ marginBottom: 8 }}>
        <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: done ? 'rgba(21,82,40,0.3)' : pending ? 'rgba(242,201,76,0.1)' : 'var(--black-800)', border: `1px solid ${done ? 'rgba(111,207,111,0.3)' : pending ? 'rgba(242,201,76,0.4)' : 'var(--border)'}`, borderRadius: expanded ? '14px 14px 0 0' : 14, cursor: 'pointer', transition: 'border-radius 0.2s' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: done ? '#1A3D10' : pending ? '#2A1A00' : 'var(--black-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: done ? '#6fcf6f' : pending ? '#F2C94C' : 'var(--text-muted)', flexShrink: 0 }}>
            {done ? '✓' : pending ? '!' : '○'}
          </div>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: done ? '#6fcf6f' : pending ? '#F2C94C' : 'var(--text-muted)' }}>{label}</div>
          <span style={{ fontSize: 16, color: 'var(--text-muted)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>⌄</span>
        </div>
        {expanded && (
          <div style={{ background: 'var(--black-800)', border: `1px solid ${done ? 'rgba(111,207,111,0.3)' : pending ? 'rgba(242,201,76,0.4)' : 'var(--border)'}`, borderTop: 'none', borderRadius: '0 0 14px 14px', padding: '12px 16px' }}>
            {children}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' }}>
        สถานะรายการ
      </div>

      {/* 1. ตั๋วจำนำ */}
      <CheckRow done={hasTicket} pending={false} label="📄 ตั๋วจำนำ" expanded={expandTicket} onToggle={() => setExpandTicket(!expandTicket)}>
        {hasTicket ? (
          <img src={pawn.pawn_slip_url} onClick={() => onViewImg(pawn.pawn_slip_url)}
            loading="lazy"
            style={{ width: '100%', borderRadius: 10, maxHeight: 200, objectFit: 'contain', background: 'var(--black-700)', cursor: 'pointer', display: 'block' }} alt="pawn slip" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 12, padding: '12px', cursor: 'pointer' }}>
              <input type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) onConfirmTransfer(f) }} style={{ display: 'none' }} />
              <span style={{ fontSize: 22 }}>📷</span><span style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 600 }}>ถ่ายรูป</span>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 12, padding: '12px', cursor: 'pointer' }}>
              <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) onConfirmTransfer(f) }} style={{ display: 'none' }} />
              <span style={{ fontSize: 22 }}>🖼️</span><span style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 600 }}>เลือกจากคลัง</span>
            </label>
          </div>
        )}
      </CheckRow>

      {/* 2. โอนเงิน */}
      <CheckRow done={hasTransfer && !isPendingTransfer} pending={isPendingTransfer && isOwner} label={isPendingTransfer ? '💸 รอชาวสวนโอนเงิน' : '💸 โอนเงินแล้ว'} expanded={expandTransfer} onToggle={() => setExpandTransfer(!expandTransfer)}>
        {isPendingTransfer && isOwner ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>เลือกวิธีโอนเงิน ฿{fmt(pawn.amount)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, border: '1.5px dashed var(--border-hover)', borderRadius: 12, padding: '12px 8px', cursor: 'pointer' }}>
                <input type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) onConfirmTransfer(f) }} style={{ display: 'none' }} />
                <span style={{ fontSize: 22 }}>📷</span><span style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 600 }}>อัปสลิป</span>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, border: '1.5px dashed var(--border-hover)', borderRadius: 12, padding: '12px 8px', cursor: 'pointer' }}>
                <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) onConfirmTransfer(f) }} style={{ display: 'none' }} />
                <span style={{ fontSize: 22 }}>🖼️</span><span style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 600 }}>จากคลัง</span>
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={onBypassCash} style={{ padding: '10px', borderRadius: 12, border: '1px solid rgba(111,207,111,0.4)', background: 'rgba(111,207,111,0.08)', color: '#6fcf6f', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>💵 เงินสด</button>
              <button onClick={onBypassPrepaid} style={{ padding: '10px', borderRadius: 12, border: '1px solid rgba(242,201,76,0.3)', background: 'rgba(242,201,76,0.06)', color: 'var(--gold)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🤝 ฝากไว้</button>
            </div>
          </div>
        ) : transferSlips.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {transferSlips.map((t: any) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {t.slip_url && (
                  <img src={t.slip_url} onClick={() => onViewImg(t.slip_url)} loading="lazy"
                    style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', cursor: 'pointer', flexShrink: 0 }} alt="slip" />
                )}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{t.direction === 'me_to_mom' ? '💸 ฉันโอนให้แม่' : '💰 แม่โอนให้ฉัน'}</div>
                  {t.amount && <div style={{ fontSize: 15, color: 'var(--gold)', fontWeight: 700 }}>฿{fmt(t.amount)}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>ไม่มีสลิป (เงินสด/ฝากไว้)</div>
        )}
      </CheckRow>

      {/* 3. ประวัติตัดดอก */}
      {pawn.tx_status === 'active' && (
        <CheckRow done={interests.length > 0} pending={false} label={`🥚 เก็บไข่ ${interests.length > 0 ? `${interests.length} ครั้ง รวม ฿${fmt(totalInterest)}` : '(ยังไม่มี)'}`} expanded={expandInterest} onToggle={() => setExpandInterest(!expandInterest)}>
          {interests.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {interests.map((int: any, i: number) => (
                <div key={int.id} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8, borderBottom: i < interests.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                  {int.slip_url ? (
                    <img src={int.slip_url} onClick={() => onViewImg(int.slip_url)} loading="lazy"
                      style={{ width: 50, height: 50, borderRadius: 8, objectFit: 'cover', cursor: 'pointer', flexShrink: 0 }} alt="interest" />
                  ) : <div style={{ width: 50, height: 50, borderRadius: 8, background: 'var(--black-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>✂️</div>}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>ครั้งที่ {i + 1}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{toThaiDateShort(int.payment_date)}</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#6fcf6f' }}>+฿{fmt(int.amount)}</div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid rgba(242,201,76,0.2)' }}>
                <span style={{ fontWeight: 700 }}>รวม</span>
                <span style={{ fontWeight: 800, color: 'var(--gold)', fontSize: 16 }}>฿{fmt(totalInterest)}</span>
              </div>
            </div>
          ) : <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>ยังไม่มีการเก็บไข่</div>}
        </CheckRow>
      )}

      {/* 4. ไถ่ถอน */}
      {redemption && (
        <CheckRow done={true} pending={false} label={`🐣 คืนห่านแล้ว · ${toThaiDateShort(redemption.redeem_date)}`} expanded={expandRedeem} onToggle={() => setExpandRedeem(!expandRedeem)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
            <span style={{ color: 'var(--text-muted)' }}>ดอกรวม</span>
            <span style={{ color: '#6fcf6f', fontWeight: 700 }}>+฿{fmt(redemption.interest_total)}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {redemption.pawn_slip_url && (
              <div onClick={() => onViewImg(redemption.pawn_slip_url)} style={{ cursor: 'pointer', position: 'relative' }}>
                <img src={redemption.pawn_slip_url} loading="lazy" style={{ width: '100%', height: 80, borderRadius: 10, objectFit: 'cover' }} alt="redeem" />
                <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔍</div>
              </div>
            )}
            {redemption.transfer_slip_url && (
              <div onClick={() => onViewImg(redemption.transfer_slip_url)} style={{ cursor: 'pointer', position: 'relative' }}>
                <img src={redemption.transfer_slip_url} loading="lazy" style={{ width: '100%', height: 80, borderRadius: 10, objectFit: 'cover' }} alt="transfer" />
                <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔍</div>
              </div>
            )}
          </div>
        </CheckRow>
      )}
    </div>
  )
}
