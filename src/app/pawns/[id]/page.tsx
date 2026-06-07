'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ToastProvider'
import { toThaiDateLong, fmt } from '@/lib/utils'
import { getSession } from '@/lib/auth'
import PawnChecklist from '@/components/PawnChecklist'
import { uploadSlip } from '@/lib/slip-storage'
import { errorMessage } from '@/lib/validation'

type LinkPawn = {
  id?: string
  ticket_no: string
  amount: number
  pawn_date?: string
  renewal_principal_paid?: number
}

type PawnDetailRow = {
  id: string
  ticket_no: string
  pawn_date: string
  amount: number
  status: string
  tx_status: string
  notes: string | null
  pawn_slip_url: string | null
  renewed_from_id: string | null
  renewal_principal_paid: number | null
}

type InterestRow = {
  id: string
  payment_date: string
  amount: number
  slip_url: string | null
}

type RedemptionRow = {
  id: string
  redeem_date: string
  interest_total: number
  pawn_slip_url: string | null
  transfer_slip_url: string | null
}

type TransferSlipRow = {
  id: string
  direction: string
  slip_url: string | null
  amount: number | null
  created_at: string
}

export default function PawnDetail() {
  const router = useRouter()
  const { id } = useParams()
  const { showToast } = useToast()
  const user = getSession()
  const isOwner = user?.role === 'owner'
  const [pawn, setPawn] = useState<PawnDetailRow | null>(null)
  const [interests, setInterests] = useState<InterestRow[]>([])
  const [redemption, setRedemption] = useState<RedemptionRow | null>(null)
  const [transferSlips, setTransferSlips] = useState<TransferSlipRow[]>([])
  const [renewedFrom, setRenewedFrom] = useState<LinkPawn | null>(null)
  const [renewedTo, setRenewedTo] = useState<LinkPawn | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewImg, setViewImg] = useState('')
  const [uploadingPawnSlip, setUploadingPawnSlip] = useState(false)

  useEffect(() => {
    if (id) {
      void loadData()
    }
  }, [id])

  async function loadData() {
    const { data: currentPawn } = await supabase
      .from('pawns')
      .select('id, ticket_no, pawn_date, amount, status, tx_status, notes, pawn_slip_url, renewed_from_id, renewal_principal_paid')
      .eq('id', id)
      .single()

    if (currentPawn) {
      const pawnRow = currentPawn as PawnDetailRow
      setPawn(pawnRow)

      if (pawnRow.renewed_from_id) {
        const { data: prev } = await supabase.from('pawns').select('id, ticket_no, amount, pawn_date').eq('id', pawnRow.renewed_from_id).single()
        setRenewedFrom((prev as LinkPawn | null) || null)
      } else {
        setRenewedFrom(null)
      }

      const { data: next } = await supabase.from('pawns').select('id, ticket_no, amount, renewal_principal_paid').eq('renewed_from_id', pawnRow.id).single()
      setRenewedTo((next as LinkPawn | null) || null)
    }

    const { data: interestData } = await supabase
      .from('interest_payments')
      .select('id, payment_date, amount, slip_url')
      .eq('pawn_id', id)
      .order('payment_date')
    setInterests((interestData as InterestRow[] | null) || [])

    const { data: redemptionData } = await supabase
      .from('redemptions')
      .select('id, redeem_date, interest_total, pawn_slip_url, transfer_slip_url')
      .eq('pawn_id', id)
      .single()
    setRedemption((redemptionData as RedemptionRow | null) || null)

    const { data: transferData } = await supabase
      .from('transfer_slips')
      .select('id, direction, slip_url, amount, created_at')
      .eq('pawn_id', id)
      .order('created_at')
    setTransferSlips((transferData as TransferSlipRow[] | null) || [])

    setLoading(false)
  }

  async function confirmTransfer(file: File) {
    if (!pawn) return
    setUploadingPawnSlip(true)
    try {
      const slipUrl = await uploadSlip(file, 'transfer')
      await supabase.from('transfer_slips').insert({
        pawn_id: id,
        direction: 'me_to_mom',
        slip_url: slipUrl,
        amount: pawn.amount,
        confirmed_at: new Date().toISOString(),
      })
      await supabase.from('pawns').update({ tx_status: 'active' }).eq('id', id)
      await supabase.from('notifications').insert({
        type: 'transfer_confirmed',
        message: `โอนเงินแล้ว! ตั๋ว #${pawn.ticket_no} ฿${pawn.amount.toLocaleString('th-TH')}`,
        pawn_id: String(id),
      })
      await loadData()
      showToast({ tone: 'success', title: 'บันทึกสำเร็จ', message: 'ยืนยันการโอนเงินเรียบร้อยแล้ว' })
    } catch (e) {
      showToast({ tone: 'error', title: 'บันทึกไม่สำเร็จ', message: errorMessage(e) })
    } finally {
      setUploadingPawnSlip(false)
    }
  }

  async function handleBypassCash() {
    if (!window.confirm('ยืนยันว่าโอนเงินสดให้เจ้หลุยแล้ว?')) return
    if (!pawn) return

    setUploadingPawnSlip(true)
    await supabase.from('pawns').update({ tx_status: 'active' }).eq('id', id)
    await supabase.from('notifications').insert({ type: 'bypass_cash', message: `เคลียร์เงินสดแล้ว ตั๋ว #${pawn.ticket_no}`, pawn_id: String(id) })
    await loadData()
    setUploadingPawnSlip(false)
    showToast({ tone: 'success', title: 'อัปเดตแล้ว', message: 'เคลียร์รายการเงินสดเรียบร้อยแล้ว' })
  }

  async function handleBypassPrepaid() {
    if (!window.confirm('ยืนยันว่าฝากเงินไว้ล่วงหน้าแล้ว?')) return
    if (!pawn) return

    setUploadingPawnSlip(true)
    await supabase.from('pawns').update({ tx_status: 'active' }).eq('id', id)
    await supabase.from('notifications').insert({ type: 'bypass_prepaid', message: `ฝากเงินล่วงหน้าแล้ว ตั๋ว #${pawn.ticket_no}`, pawn_id: String(id) })
    await loadData()
    setUploadingPawnSlip(false)
    showToast({ tone: 'success', title: 'อัปเดตแล้ว', message: 'บันทึกการฝากเงินล่วงหน้าเรียบร้อยแล้ว' })
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--gold)', fontSize: 18 }}>กำลังโหลด...</div>
  if (!pawn) return <div style={{ padding: 40, color: 'var(--text-muted)', textAlign: 'center' }}>ไม่พบข้อมูล</div>

  const isAdjustedToNewTicket = Boolean(renewedTo)
  const adjustedType = renewedTo ? (Number(renewedTo.renewal_principal_paid) < 0 ? 'เพิ่มยอด' : 'ลดต้น') : ''
  const headerBadgeClass = pawn.status === 'active' ? 'badge-active' : isAdjustedToNewTicket ? 'badge-pending' : 'badge-redeemed'
  const headerBadgeLabel = pawn.status === 'active' ? 'จำนำอยู่' : isAdjustedToNewTicket ? `${adjustedType} -> #${renewedTo?.ticket_no}` : 'ไถ่ถอนไปแล้ว'
  const cameFromTopup = Number(pawn.renewal_principal_paid) < 0

  return (
    <main className="page-container">
      {viewImg && (
        <div onClick={() => setViewImg('')} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.97)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <img src={viewImg} loading="lazy" style={{ maxWidth: '100%', maxHeight: '90dvh', borderRadius: 12, objectFit: 'contain' }} alt="preview" />
          <button onClick={() => setViewImg('')} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 99, width: 44, height: 44, fontSize: 22, cursor: 'pointer' }}>×</button>
          <div style={{ position: 'absolute', bottom: 24, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>แตะเพื่อปิด</div>
        </div>
      )}

      <div style={{ padding: '56px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/pawns')} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 26, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 22, fontWeight: 800 }}>ตั๋ว #{pawn.ticket_no}</div>
        <span className={headerBadgeClass} style={{ marginLeft: 'auto' }}>
          {headerBadgeLabel}
        </span>
      </div>

      {renewedTo && (
        <div onClick={() => router.push(`/pawns/${renewedTo.id}`)} style={{ background: 'rgba(242,201,76,0.08)', border: '1px solid rgba(242,201,76,0.28)', borderRadius: 14, padding: '12px 16px', marginBottom: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔗</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>{adjustedType} -> ตั๋วใหม่ #{renewedTo.ticket_no}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ยอดใหม่ ฿{fmt(renewedTo.amount)}</div>
          </div>
          <span style={{ fontSize: 16, color: 'var(--gold)' }}>›</span>
        </div>
      )}

      {renewedFrom && (
        <div onClick={() => router.push(`/pawns/${pawn.renewed_from_id}`)} style={{ background: 'rgba(242,201,76,0.06)', border: '1px solid rgba(242,201,76,0.2)', borderRadius: 14, padding: '12px 16px', marginBottom: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔗</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--gold-light)', fontWeight: 600 }}>{cameFromTopup ? 'เพิ่มยอดจากตั๋ว' : 'ลดต้นจากตั๋ว'} #{renewedFrom.ticket_no}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ต้นเดิม ฿{fmt(renewedFrom.amount)} · {cameFromTopup ? 'เพิ่มยอด' : 'ตัดต้น'} ฿{fmt(Math.abs(Number(pawn.renewal_principal_paid) || 0))}</div>
          </div>
          <span style={{ fontSize: 16, color: 'var(--gold-light)' }}>›</span>
        </div>
      )}

      <div className="panel-gold" style={{ padding: 20, marginBottom: 16 }}>
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
        {pawn.notes && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-secondary)' }}>{pawn.notes}</div>}
      </div>

      <PawnChecklist
        pawn={pawn}
        transferSlips={transferSlips}
        interests={interests}
        redemption={redemption}
        onViewImg={setViewImg}
        onConfirmTransfer={confirmTransfer}
        onBypassCash={handleBypassCash}
        onBypassPrepaid={handleBypassPrepaid}
        uploadingPawnSlip={uploadingPawnSlip}
        isOwner={isOwner}
      />

      {pawn.status === 'active' && pawn.tx_status === 'active' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => router.push(`/interest?pawn_id=${id}`)} className="btn-secondary" style={{ fontSize: 16 }}>เก็บไข่</button>
          <button onClick={() => router.push(`/renew?pawn_id=${id}`)} className="btn-secondary" style={{ fontSize: 16 }}>ลดต้น</button>
          <button onClick={() => router.push(`/topup?pawn_id=${id}`)} className="btn-secondary" style={{ fontSize: 16 }}>เพิ่มยอด</button>
          <button onClick={() => router.push(`/redeem?pawn_id=${id}`)} className="btn-primary" style={{ fontSize: 17 }}>คืนห่าน</button>
        </div>
      )}
      <div style={{ height: 32 }} />
    </main>
  )
}
