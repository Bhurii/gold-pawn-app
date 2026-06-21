'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import PawnChecklist from '@/components/PawnChecklist'
import { useToast } from '@/components/ToastProvider'
import { getSession } from '@/lib/auth'
import { createNotificationAction } from '@/lib/notification-meta'
import { pingPushDispatch } from '@/lib/push-client'
import { uploadSlip } from '@/lib/slip-storage'
import { supabase } from '@/lib/supabase'
import { fmt, toThaiDateLong } from '@/lib/utils'
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
  renewal_interest: number | null
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

type PawnDetailCache = {
  pawn: PawnDetailRow | null
  renewedFrom: LinkPawn | null
  renewedTo: LinkPawn | null
  interests: InterestRow[]
  redemption: RedemptionRow | null
  transferSlips: TransferSlipRow[]
}

export default function PawnDetail() {
  const router = useRouter()
  const { id } = useParams()
  const pawnId = Array.isArray(id) ? id[0] : id
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
  const [uploadingDocKey, setUploadingDocKey] = useState('')

  useEffect(() => {
    if (!pawnId) return
    hydrateFromCache()
    void loadData()
  }, [pawnId])

  function getCacheKey() {
    return pawnId ? `pawn-detail:${pawnId}` : ''
  }

  function hydrateFromCache() {
    const cacheKey = getCacheKey()
    if (!cacheKey || typeof window === 'undefined') return

    try {
      const raw = window.sessionStorage.getItem(cacheKey)
      if (!raw) return
      const cached = JSON.parse(raw) as PawnDetailCache
      setPawn(cached.pawn || null)
      setRenewedFrom(cached.renewedFrom || null)
      setRenewedTo(cached.renewedTo || null)
      setInterests(cached.interests || [])
      setRedemption(cached.redemption || null)
      setTransferSlips(cached.transferSlips || [])
      setLoading(false)
    } catch {
      // Ignore invalid cache and refetch.
    }
  }

  function saveCache(nextCache: PawnDetailCache) {
    const cacheKey = getCacheKey()
    if (!cacheKey || typeof window === 'undefined') return
    window.sessionStorage.setItem(cacheKey, JSON.stringify(nextCache))
  }

  async function loadData() {
    if (!pawnId) return
    try {
      const response = await fetch(`/api/pawns/${pawnId}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'โหลดข้อมูลตั๋วไม่สำเร็จ')
      }

      const nextCache: PawnDetailCache = {
        pawn: (payload?.pawn as PawnDetailRow | null) || null,
        renewedFrom: (payload?.renewedFrom as LinkPawn | null) || null,
        renewedTo: (payload?.renewedTo as LinkPawn | null) || null,
        interests: (payload?.interests as InterestRow[] | null) || [],
        redemption: (payload?.redemption as RedemptionRow | null) || null,
        transferSlips: (payload?.transferSlips as TransferSlipRow[] | null) || [],
      }

      setPawn(nextCache.pawn)
      setRenewedFrom(nextCache.renewedFrom)
      setRenewedTo(nextCache.renewedTo)
      setInterests(nextCache.interests)
      setRedemption(nextCache.redemption)
      setTransferSlips(nextCache.transferSlips)
      saveCache(nextCache)
    } catch {
      setPawn(null)
      setRenewedFrom(null)
      setRenewedTo(null)
      setInterests([])
      setRedemption(null)
      setTransferSlips([])
    } finally {
      setLoading(false)
    }
  }

  function getExpectedTransferMeta() {
    if (!pawn) return null

    if (pawn.renewed_from_id) {
      const principalChange = Number(pawn.renewal_principal_paid || 0)
      const interest = Number(pawn.renewal_interest || 0)
      if (principalChange < 0) {
        return {
          amount: Math.abs(principalChange),
          direction: 'mom_to_me',
        } as const
      }

      return {
        amount: principalChange + interest,
        direction: 'me_to_mom',
      } as const
    }

    return {
      amount: pawn.amount,
      direction: 'me_to_mom',
    } as const
  }

  async function uploadPawnTicketSlip(file: File) {
    if (!pawn) return

    setUploadingDocKey('pawn_ticket')
    try {
      const slipUrl = await uploadSlip(file, 'pawns')
      await supabase.from('pawns').update({ pawn_slip_url: slipUrl }).eq('id', pawnId)
      await loadData()
      showToast({ tone: 'success', title: 'อัปรูปตั๋วแล้ว', message: `ตั๋ว #${pawn.ticket_no} ถูกบันทึกรูปเรียบร้อย` })
    } catch (error) {
      showToast({ tone: 'error', title: 'อัปรูปไม่สำเร็จ', message: errorMessage(error) })
    } finally {
      setUploadingDocKey('')
    }
  }

  async function uploadInterestSlip(interestId: string, file: File) {
    setUploadingDocKey(`interest_${interestId}`)
    try {
      const slipUrl = await uploadSlip(file, 'interest')
      await supabase.from('interest_payments').update({ slip_url: slipUrl }).eq('id', interestId)
      await loadData()
      showToast({ tone: 'success', title: 'อัปสลิปแล้ว', message: 'อัปสลิปตัดดอกย้อนหลังเรียบร้อย' })
    } catch (error) {
      showToast({ tone: 'error', title: 'อัปสลิปไม่สำเร็จ', message: errorMessage(error) })
    } finally {
      setUploadingDocKey('')
    }
  }

  async function uploadRedemptionSlip(column: 'pawn_slip_url' | 'transfer_slip_url', folder: string, file: File) {
    if (!redemption) return

    setUploadingDocKey(`redemption_${column}`)
    try {
      const slipUrl = await uploadSlip(file, folder)
      await supabase.from('redemptions').update({ [column]: slipUrl }).eq('id', redemption.id)
      await loadData()
      showToast({ tone: 'success', title: 'อัปหลักฐานแล้ว', message: 'เพิ่มหลักฐานการไถ่ถอนย้อนหลังเรียบร้อย' })
    } catch (error) {
      showToast({ tone: 'error', title: 'อัปหลักฐานไม่สำเร็จ', message: errorMessage(error) })
    } finally {
      setUploadingDocKey('')
    }
  }

  async function confirmTransfer(file: File) {
    if (!pawn) return
    setUploadingPawnSlip(true)
    try {
      const transferMeta = getExpectedTransferMeta()
      if (!transferMeta) return
      const slipUrl = await uploadSlip(file, 'transfer')
      await supabase.from('transfer_slips').insert({
        pawn_id: pawnId,
        direction: transferMeta.direction,
        slip_url: slipUrl,
        amount: transferMeta.amount,
        confirmed_at: new Date().toISOString(),
      })
      if (pawn.tx_status === 'pending_transfer') {
        await supabase.from('pawns').update({ tx_status: 'active' }).eq('id', pawnId)
      }
      await supabase.from('notifications').insert({
        type: 'transfer_confirmed',
        message: `อัปสลิปโอนเงินแล้ว ตั๋ว #${pawn.ticket_no} ฿${transferMeta.amount.toLocaleString('th-TH')}`,
        pawn_id: String(pawnId),
        action_url: createNotificationAction(`/pawns/${pawnId}`, ['owner']),
      })
      await pingPushDispatch()
      await loadData()
      showToast({ tone: 'success', title: 'บันทึกสำเร็จ', message: 'ยืนยันการโอนเงินเรียบร้อยแล้ว' })
    } catch (error) {
      showToast({ tone: 'error', title: 'บันทึกไม่สำเร็จ', message: errorMessage(error) })
    } finally {
      setUploadingPawnSlip(false)
    }
  }

  async function handleBypassCash() {
    if (!window.confirm('ยืนยันว่าโอนเงินสดให้เจ้หลุยแล้ว?')) return
    if (!pawn) return

    setUploadingPawnSlip(true)
    await supabase.from('pawns').update({ tx_status: 'active' }).eq('id', pawnId)
    await supabase.from('notifications').insert({
      type: 'bypass_cash',
      message: `เคลียร์เงินสดแล้ว ตั๋ว #${pawn.ticket_no}`,
      pawn_id: String(pawnId),
      action_url: createNotificationAction(`/pawns/${pawnId}`, ['owner']),
    })
    await pingPushDispatch()
    await loadData()
    setUploadingPawnSlip(false)
    showToast({ tone: 'success', title: 'อัปเดตแล้ว', message: 'เคลียร์รายการเงินสดเรียบร้อยแล้ว' })
  }

  async function handleBypassPrepaid() {
    if (!window.confirm('ยืนยันว่าฝากเงินไว้ล่วงหน้าแล้ว?')) return
    if (!pawn) return

    setUploadingPawnSlip(true)
    await supabase.from('pawns').update({ tx_status: 'active' }).eq('id', pawnId)
    await supabase.from('notifications').insert({
      type: 'bypass_prepaid',
      message: `ฝากเงินล่วงหน้าแล้ว ตั๋ว #${pawn.ticket_no}`,
      pawn_id: String(pawnId),
      action_url: createNotificationAction(`/pawns/${pawnId}`, ['owner']),
    })
    await pingPushDispatch()
    await loadData()
    setUploadingPawnSlip(false)
    showToast({ tone: 'success', title: 'อัปเดตแล้ว', message: 'บันทึกการฝากเงินล่วงหน้าเรียบร้อยแล้ว' })
  }

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--gold)', fontSize: 18 }}>กำลังโหลด...</div>
  }

  if (!pawn) {
    return <div style={{ padding: 40, color: 'var(--text-muted)', textAlign: 'center' }}>ไม่พบข้อมูล</div>
  }

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
            <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>{adjustedType}{' -> '}ตั๋วใหม่ #{renewedTo.ticket_no}</div>
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
        onUploadPawnSlip={uploadPawnTicketSlip}
        onUploadInterestSlip={uploadInterestSlip}
        onUploadRedemptionSlip={uploadRedemptionSlip}
        onConfirmTransfer={confirmTransfer}
        onBypassCash={handleBypassCash}
        onBypassPrepaid={handleBypassPrepaid}
        uploadingPawnSlip={uploadingPawnSlip}
        uploadingDocKey={uploadingDocKey}
        isOwner={isOwner}
      />

      {pawn.status === 'active' && pawn.tx_status === 'active' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => router.push(`/interest?pawn_id=${pawnId}`)} className="btn-secondary" style={{ fontSize: 16 }}>ตัดดอก</button>
          <button onClick={() => router.push(`/renew?pawn_id=${pawnId}`)} className="btn-secondary" style={{ fontSize: 16 }}>ลดต้น</button>
          <button onClick={() => router.push(`/topup?pawn_id=${pawnId}`)} className="btn-secondary" style={{ fontSize: 16 }}>เพิ่มยอด</button>
          <button onClick={() => router.push(`/redeem?pawn_id=${pawnId}`)} className="btn-primary" style={{ fontSize: 17 }}>ไถ่ถอน</button>
        </div>
      )}
      <div style={{ height: 32 }} />
    </main>
  )
}
