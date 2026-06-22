'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { fmt, toThaiDateShort } from '@/lib/utils'

interface Props {
  pawn: any
  transferSlips: any[]
  interests: any[]
  redemption: any
  onViewImg: (url: string) => void
  onUploadPawnSlip: (file: File) => void
  onUploadInterestSlip: (interestId: string, file: File) => void
  onEditInterest: (interest: any) => void
  onDeleteInterest: (interest: any) => void
  onUploadRedemptionSlip: (column: 'pawn_slip_url' | 'transfer_slip_url', folder: string, file: File) => void
  onConfirmTransfer: (file: File) => void
  onBypassCash: () => void
  onBypassPrepaid: () => void
  uploadingPawnSlip: boolean
  uploadingDocKey: string
  isOwner: boolean
}

function UploadButtons({
  onSelect,
  busy = false,
}: {
  onSelect: (file: File) => void
  busy?: boolean
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 12, padding: '12px', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>
        <input type="file" accept="image/*" capture="environment" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) onSelect(file) }} style={{ display: 'none' }} />
        <span style={{ fontSize: 22 }}>📷</span>
        <span style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 600 }}>{busy ? 'กำลังอัป...' : 'ถ่ายรูป'}</span>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 12, padding: '12px', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>
        <input type="file" accept="image/*" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) onSelect(file) }} style={{ display: 'none' }} />
        <span style={{ fontSize: 22 }}>🖼️</span>
        <span style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 600 }}>เลือกจากคลัง</span>
      </label>
    </div>
  )
}

function ExpandRow({
  done,
  pending,
  label,
  expanded,
  onToggle,
  children,
}: {
  done: boolean
  pending: boolean
  label: string
  expanded: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: done ? 'rgba(242,201,76,0.08)' : pending ? 'rgba(201,146,42,0.1)' : 'var(--black-800)',
          border: `1px solid ${done ? 'rgba(242,201,76,0.24)' : pending ? 'rgba(242,201,76,0.3)' : 'var(--border)'}`,
          borderRadius: expanded ? '14px 14px 0 0' : 14,
          cursor: 'pointer',
          transition: 'border-radius 0.2s',
        }}
      >
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: done ? 'rgba(242,201,76,0.14)' : pending ? '#2A1A00' : 'var(--black-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: done ? 'var(--gold-light)' : pending ? '#F2C94C' : 'var(--text-muted)', flexShrink: 0 }}>
          {done ? '✓' : pending ? '!' : '○'}
        </div>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: done ? 'var(--gold-light)' : pending ? '#F2C94C' : 'var(--text-muted)' }}>{label}</div>
        <span style={{ fontSize: 16, color: 'var(--text-muted)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>⌄</span>
      </div>
      {expanded && (
        <div style={{ background: 'var(--black-800)', border: `1px solid ${done ? 'rgba(242,201,76,0.24)' : pending ? 'rgba(242,201,76,0.3)' : 'var(--border)'}`, borderTop: 'none', borderRadius: '0 0 14px 14px', padding: '12px 16px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

export default function PawnChecklist({
  pawn,
  transferSlips,
  interests,
  redemption,
  onViewImg,
  onUploadPawnSlip,
  onUploadInterestSlip,
  onEditInterest,
  onDeleteInterest,
  onUploadRedemptionSlip,
  onConfirmTransfer,
  onBypassCash,
  onBypassPrepaid,
  uploadingPawnSlip,
  uploadingDocKey,
  isOwner,
}: Props) {
  const [expandTicket, setExpandTicket] = useState(false)
  const [expandTransfer, setExpandTransfer] = useState(false)
  const [expandInterest, setExpandInterest] = useState(false)
  const [expandRedeem, setExpandRedeem] = useState(false)
  const [expandedInterestUploadId, setExpandedInterestUploadId] = useState('')
  const [expandedRedeemUploadKey, setExpandedRedeemUploadKey] = useState('')

  const hasTicket = !!pawn.pawn_slip_url
  const hasTransfer = transferSlips.length > 0 || pawn.tx_status === 'active'
  const isPendingTransfer = pawn.tx_status === 'pending_transfer'
  const totalInterest = interests.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0)

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="section-label" style={{ marginBottom: 10 }}>
        สถานะรายการ
      </div>

      <ExpandRow done={hasTicket} pending={false} label="📄 ตั๋วจำนำ" expanded={expandTicket} onToggle={() => setExpandTicket(!expandTicket)}>
        {hasTicket ? (
          <img
            src={pawn.pawn_slip_url}
            onClick={() => onViewImg(pawn.pawn_slip_url)}
            loading="lazy"
            style={{ width: '100%', borderRadius: 10, maxHeight: 200, objectFit: 'contain', background: 'var(--black-700)', cursor: 'pointer', display: 'block' }}
            alt="pawn slip"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>ยังไม่มีรูปตั๋ว อัปย้อนหลังได้จากตรงนี้</div>
            <UploadButtons onSelect={onUploadPawnSlip} busy={uploadingDocKey === 'pawn_ticket'} />
          </div>
        )}
      </ExpandRow>

      <ExpandRow done={hasTransfer && !isPendingTransfer} pending={isPendingTransfer && isOwner} label={isPendingTransfer ? '💸 รอโอนเงิน' : '💸 โอนเงินแล้ว'} expanded={expandTransfer} onToggle={() => setExpandTransfer(!expandTransfer)}>
        {isPendingTransfer && isOwner ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
              {uploadingPawnSlip ? 'กำลังอัปสลิป...' : 'อัปสลิปโอนเงินเพื่อยืนยันรายการนี้'}
            </div>
            <UploadButtons onSelect={onConfirmTransfer} busy={uploadingPawnSlip} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={onBypassCash} style={{ padding: '10px', borderRadius: 12, border: '1px solid rgba(242,201,76,0.24)', background: 'rgba(242,201,76,0.08)', color: 'var(--gold-light)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>💵 เงินสด</button>
              <button onClick={onBypassPrepaid} style={{ padding: '10px', borderRadius: 12, border: '1px solid rgba(242,201,76,0.3)', background: 'rgba(242,201,76,0.06)', color: 'var(--gold)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🤝 ฝากไว้</button>
            </div>
          </div>
        ) : transferSlips.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {transferSlips.map((item: any) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {item.slip_url ? (
                  <img
                    src={item.slip_url}
                    onClick={() => onViewImg(item.slip_url)}
                    loading="lazy"
                    style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', cursor: 'pointer', flexShrink: 0 }}
                    alt="slip"
                  />
                ) : (
                  <div style={{ width: 60, height: 60, borderRadius: 8, background: 'var(--black-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>💸</div>
                )}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{item.direction === 'me_to_mom' ? 'ฉันโอนให้แม่' : 'แม่โอนให้ฉัน'}</div>
                  {item.amount ? <div style={{ fontSize: 15, color: 'var(--gold)', fontWeight: 700 }}>฿{fmt(item.amount)}</div> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>ไม่มีสลิปในรายการนี้</div>
        )}
      </ExpandRow>

      {pawn.tx_status === 'active' && (
        <ExpandRow done={interests.length > 0} pending={false} label={`🥚 ตัดดอก ${interests.length > 0 ? `${interests.length} ครั้ง รวม ฿${fmt(totalInterest)}` : '(ยังไม่มี)'}`} expanded={expandInterest} onToggle={() => setExpandInterest(!expandInterest)}>
          {interests.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {interests.map((item: any, index: number) => (
                <div key={item.id} style={{ paddingBottom: 8, borderBottom: index < interests.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {item.slip_url ? (
                      <img src={item.slip_url} onClick={() => onViewImg(item.slip_url)} loading="lazy" style={{ width: 50, height: 50, borderRadius: 8, objectFit: 'cover', cursor: 'pointer', flexShrink: 0 }} alt="interest" />
                    ) : (
                      <div style={{ width: 50, height: 50, borderRadius: 8, background: 'var(--black-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>✂️</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>ครั้งที่ {index + 1}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{toThaiDateShort(item.payment_date)}</div>
                      {item.note ? <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{item.note}</div> : null}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold-light)' }}>+฿{fmt(item.amount)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => onEditInterest(item)}
                      style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-hover)', background: 'rgba(242,201,76,0.08)', color: 'var(--gold-light)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      แก้ไข
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteInterest(item)}
                      style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(210,89,89,0.35)', background: 'rgba(210,89,89,0.08)', color: '#FFB4B4', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      ลบ
                    </button>
                    {!item.slip_url ? (
                      <button
                        type="button"
                        onClick={() => setExpandedInterestUploadId(expandedInterestUploadId === item.id ? '' : item.id)}
                        style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-hover)', background: 'rgba(255,255,255,0.03)', color: 'var(--gold)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        เพิ่มสลิปย้อนหลัง
                      </button>
                    ) : null}
                  </div>
                  {!item.slip_url && expandedInterestUploadId === item.id ? (
                    <div style={{ marginTop: 10 }}>
                      <UploadButtons onSelect={(file) => onUploadInterestSlip(item.id, file)} busy={uploadingDocKey === `interest_${item.id}`} />
                    </div>
                  ) : null}
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid rgba(242,201,76,0.2)' }}>
                <span style={{ fontWeight: 700 }}>รวม</span>
                <span style={{ fontWeight: 800, color: 'var(--gold)', fontSize: 16 }}>฿{fmt(totalInterest)}</span>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>ยังไม่มีการตัดดอก</div>
          )}
        </ExpandRow>
      )}

      {redemption && (
        <ExpandRow done={true} pending={false} label={`🐣 ไถ่ถอนไปแล้ว · ${toThaiDateShort(redemption.redeem_date)}`} expanded={expandRedeem} onToggle={() => setExpandRedeem(!expandRedeem)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
            <span style={{ color: 'var(--text-muted)' }}>ดอกรวม</span>
            <span style={{ color: 'var(--gold-light)', fontWeight: 700 }}>+฿{fmt(redemption.interest_total)}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {redemption.pawn_slip_url ? (
              <div onClick={() => onViewImg(redemption.pawn_slip_url)} style={{ cursor: 'pointer', position: 'relative' }}>
                <img src={redemption.pawn_slip_url} loading="lazy" style={{ width: '100%', height: 80, borderRadius: 10, objectFit: 'cover' }} alt="redeem pawn" />
                <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔍</div>
              </div>
            ) : (
              <div style={{ borderRadius: 10, background: 'var(--black-700)', minHeight: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>
                <div>ยังไม่มีรูปตั๋ว</div>
                <button
                  type="button"
                  onClick={() => setExpandedRedeemUploadKey(expandedRedeemUploadKey === 'pawn_slip_url' ? '' : 'pawn_slip_url')}
                  style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-hover)', background: 'rgba(255,255,255,0.03)', color: 'var(--gold)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  เพิ่มสลิปย้อนหลัง
                </button>
              </div>
            )}
            {redemption.transfer_slip_url ? (
              <div onClick={() => onViewImg(redemption.transfer_slip_url)} style={{ cursor: 'pointer', position: 'relative' }}>
                <img src={redemption.transfer_slip_url} loading="lazy" style={{ width: '100%', height: 80, borderRadius: 10, objectFit: 'cover' }} alt="redeem transfer" />
                <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔍</div>
              </div>
            ) : (
              <div style={{ borderRadius: 10, background: 'var(--black-700)', minHeight: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>
                <div>ยังไม่มีสลิป</div>
                <button
                  type="button"
                  onClick={() => setExpandedRedeemUploadKey(expandedRedeemUploadKey === 'transfer_slip_url' ? '' : 'transfer_slip_url')}
                  style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-hover)', background: 'rgba(255,255,255,0.03)', color: 'var(--gold)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  เพิ่มสลิปย้อนหลัง
                </button>
              </div>
            )}
          </div>
          {expandedRedeemUploadKey === 'pawn_slip_url' && !redemption.pawn_slip_url ? (
            <div style={{ marginTop: 10 }}>
              <UploadButtons onSelect={(file) => onUploadRedemptionSlip('pawn_slip_url', 'redeem-pawn', file)} busy={uploadingDocKey === 'redemption_pawn_slip_url'} />
            </div>
          ) : null}
          {expandedRedeemUploadKey === 'transfer_slip_url' && !redemption.transfer_slip_url ? (
            <div style={{ marginTop: 10 }}>
              <UploadButtons onSelect={(file) => onUploadRedemptionSlip('transfer_slip_url', 'redeem-transfer', file)} busy={uploadingDocKey === 'redemption_transfer_slip_url'} />
            </div>
          ) : null}
        </ExpandRow>
      )}
    </div>
  )
}
