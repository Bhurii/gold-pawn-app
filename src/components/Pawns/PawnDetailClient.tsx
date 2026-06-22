'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ActionAuditPanel from '@/components/ActionAuditPanel'
import PawnChecklist from '@/components/PawnChecklist'
import { useToast } from '@/components/ToastProvider'
import { getSession } from '@/lib/auth'
import { createNotificationAction } from '@/lib/notification-meta'
import { insertNotificationRecord } from '@/lib/notification-store'
import { getNotificationRecipientsForFundOwner, getReadableUserName } from '@/lib/fund-owner'
import { pingPushDispatch } from '@/lib/push-client'
import { uploadSlip } from '@/lib/slip-storage'
import { assertSupabaseMutation } from '@/lib/supabase-mutation'
import { supabase } from '@/lib/supabase'
import type { InterestRow, LinkPawn, PawnDetailData, PawnDetailRow, RedemptionRow, TransferSlipRow } from '@/lib/server/pawn-detail'
import { fmt, toThaiDateLong } from '@/lib/utils'
import { errorMessage } from '@/lib/validation'

type Props = {
  pawnId: string
  initialData: PawnDetailData
}

const EMPTY_INTEREST_FORM = {
  amount: '',
  payment_date: '',
  note: '',
}

export default function PawnDetailClient({ pawnId, initialData }: Props) {
  const router = useRouter()
  const { showToast } = useToast()
  const user = getSession()
  const canManageTransfer = user?.role === 'owner' || user?.role === 'agent'
  const [pawn, setPawn] = useState<PawnDetailRow | null>(initialData.pawn)
  const [interests, setInterests] = useState<InterestRow[]>(initialData.interests)
  const [redemption, setRedemption] = useState<RedemptionRow | null>(initialData.redemption)
  const [transferSlips, setTransferSlips] = useState<TransferSlipRow[]>(initialData.transferSlips)
  const [renewedFrom, setRenewedFrom] = useState<LinkPawn | null>(initialData.renewedFrom)
  const [renewedTo, setRenewedTo] = useState<LinkPawn | null>(initialData.renewedTo)
  const [audits, setAudits] = useState(initialData.audits)
  const [viewImg, setViewImg] = useState('')
  const [uploadingPawnSlip, setUploadingPawnSlip] = useState(false)
  const [uploadingDocKey, setUploadingDocKey] = useState('')
  const [editingInterest, setEditingInterest] = useState<InterestRow | null>(null)
  const [deletingInterest, setDeletingInterest] = useState<InterestRow | null>(null)
  const [interestForm, setInterestForm] = useState(EMPTY_INTEREST_FORM)
  const [actionRemark, setActionRemark] = useState('')
  const [actionSaving, setActionSaving] = useState(false)

  useEffect(() => {
    saveCache(initialData)
    hydrateFromCache()
    void loadData()
  }, [pawnId])

  function getCacheKey() {
    return `pawn-detail:${pawnId}`
  }

  function hydrateFromCache() {
    if (typeof window === 'undefined') return

    try {
      const raw = window.sessionStorage.getItem(getCacheKey())
      if (!raw) return
      const cached = JSON.parse(raw) as PawnDetailData
      setPawn(cached.pawn || null)
      setRenewedFrom(cached.renewedFrom || null)
      setRenewedTo(cached.renewedTo || null)
      setInterests(cached.interests || [])
      setRedemption(cached.redemption || null)
      setTransferSlips(cached.transferSlips || [])
      setAudits(cached.audits || [])
    } catch {
      // Ignore invalid cache.
    }
  }

  function saveCache(nextCache: PawnDetailData) {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(getCacheKey(), JSON.stringify(nextCache))
  }

  async function loadData() {
    try {
      const response = await fetch(`/api/pawns/${pawnId}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'โหลดข้อมูลตั๋วไม่สำเร็จ')
      }

      const nextData: PawnDetailData = {
        pawn: (payload?.pawn as PawnDetailRow | null) || null,
        renewedFrom: (payload?.renewedFrom as LinkPawn | null) || null,
        renewedTo: (payload?.renewedTo as LinkPawn | null) || null,
        interests: (payload?.interests as InterestRow[] | null) || [],
        redemption: (payload?.redemption as RedemptionRow | null) || null,
        transferSlips: (payload?.transferSlips as TransferSlipRow[] | null) || [],
        audits: (payload?.audits as PawnDetailData['audits'] | null) || [],
      }

      setPawn(nextData.pawn)
      setRenewedFrom(nextData.renewedFrom)
      setRenewedTo(nextData.renewedTo)
      setInterests(nextData.interests)
      setRedemption(nextData.redemption)
      setTransferSlips(nextData.transferSlips)
      setAudits(nextData.audits)
      saveCache(nextData)
    } catch {
      // Keep current state on silent refresh errors.
    }
  }

  function closeInterestDialogs() {
    setEditingInterest(null)
    setDeletingInterest(null)
    setInterestForm(EMPTY_INTEREST_FORM)
    setActionRemark('')
  }

  function openEditInterest(item: InterestRow) {
    setDeletingInterest(null)
    setEditingInterest(item)
    setInterestForm({
      amount: String(item.amount || ''),
      payment_date: item.payment_date || '',
      note: item.note || '',
    })
    setActionRemark('')
  }

  function openDeleteInterest(item: InterestRow) {
    setEditingInterest(null)
    setDeletingInterest(item)
    setActionRemark('')
  }

  async function submitInterestEdit() {
    if (!editingInterest) return

    setActionSaving(true)
    try {
      const amount = Number(interestForm.amount || 0)
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('จำนวนดอกเบี้ยต้องมากกว่า 0')
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(interestForm.payment_date)) {
        throw new Error('กรุณาเลือกวันที่ให้ถูกต้อง')
      }

      const response = await fetch('/api/action-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'update',
          entity_type: 'interest_payment',
          record_id: editingInterest.id,
          parent_type: 'pawn',
          parent_id: pawnId,
          remark: actionRemark,
          changes: {
            amount,
            payment_date: interestForm.payment_date,
            note: interestForm.note,
          },
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'แก้ไขรายการไม่สำเร็จ')
      }

      await loadData()
      closeInterestDialogs()
      showToast({ tone: 'success', title: 'แก้ไขแล้ว', message: 'บันทึกการแก้ไขรายการตัดดอกเรียบร้อย' })
    } catch (error) {
      showToast({ tone: 'error', title: 'บันทึกไม่สำเร็จ', message: errorMessage(error) })
    } finally {
      setActionSaving(false)
    }
  }

  async function submitInterestDelete() {
    if (!deletingInterest) return

    setActionSaving(true)
    try {
      const response = await fetch('/api/action-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'delete',
          entity_type: 'interest_payment',
          record_id: deletingInterest.id,
          parent_type: 'pawn',
          parent_id: pawnId,
          remark: actionRemark,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'ลบรายการไม่สำเร็จ')
      }

      await loadData()
      closeInterestDialogs()
      showToast({ tone: 'success', title: 'ลบแล้ว', message: 'ลบรายการตัดดอกเรียบร้อย' })
    } catch (error) {
      showToast({ tone: 'error', title: 'ลบไม่สำเร็จ', message: errorMessage(error) })
    } finally {
      setActionSaving(false)
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
      const updateResult = await supabase.from('pawns').update({ pawn_slip_url: slipUrl }).eq('id', pawnId)
      assertSupabaseMutation(updateResult, 'บันทึกรูปตั๋วไม่สำเร็จ')
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
      const updateResult = await supabase.from('interest_payments').update({ slip_url: slipUrl }).eq('id', interestId)
      assertSupabaseMutation(updateResult, 'บันทึกสลิปตัดดอกไม่สำเร็จ')
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
      const updateResult = await supabase.from('redemptions').update({ [column]: slipUrl }).eq('id', redemption.id)
      assertSupabaseMutation(updateResult, 'บันทึกหลักฐานไถ่ถอนไม่สำเร็จ')
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
      const transferInsert = await supabase.from('transfer_slips').insert({
        pawn_id: pawnId,
        direction: transferMeta.direction,
        slip_url: slipUrl,
        amount: transferMeta.amount,
        confirmed_at: new Date().toISOString(),
      })
      assertSupabaseMutation(transferInsert, 'บันทึกสลิปโอนเงินไม่สำเร็จ')
      if (pawn.tx_status === 'pending_transfer') {
        const pawnUpdate = await supabase.from('pawns').update({ tx_status: 'active' }).eq('id', pawnId)
        assertSupabaseMutation(pawnUpdate, 'อัปเดตสถานะตั๋วไม่สำเร็จ')
      }
      const notificationInsert = await insertNotificationRecord(supabase, {
        type: 'transfer_confirmed',
        message: `อัปสลิปโอนเงินแล้ว ตั๋ว #${pawn.ticket_no} ฿${transferMeta.amount.toLocaleString('th-TH')}`,
        pawn_id: String(pawnId),
        action_url: createNotificationAction(`/pawns/${pawnId}`, [...getNotificationRecipientsForFundOwner((pawn.fund_owner as 'tony' | 'louise' | 'phat') || 'tony')]),
      })
      assertSupabaseMutation(notificationInsert, 'บันทึกการแจ้งเตือนไม่สำเร็จ')
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
    try {
      const pawnUpdate = await supabase.from('pawns').update({ tx_status: 'active' }).eq('id', pawnId)
      assertSupabaseMutation(pawnUpdate, 'อัปเดตสถานะตั๋วไม่สำเร็จ')
      const notificationInsert = await insertNotificationRecord(supabase, {
        type: 'bypass_cash',
        message: `เคลียร์เงินสดแล้ว ตั๋ว #${pawn.ticket_no}`,
        pawn_id: String(pawnId),
        action_url: createNotificationAction(`/pawns/${pawnId}`, [...getNotificationRecipientsForFundOwner((pawn.fund_owner as 'tony' | 'louise' | 'phat') || 'tony')]),
      })
      assertSupabaseMutation(notificationInsert, 'บันทึกการแจ้งเตือนไม่สำเร็จ')
      await pingPushDispatch()
      await loadData()
      showToast({ tone: 'success', title: 'อัปเดตแล้ว', message: 'เคลียร์รายการเงินสดเรียบร้อยแล้ว' })
    } catch (error) {
      showToast({ tone: 'error', title: 'บันทึกไม่สำเร็จ', message: errorMessage(error) })
    } finally {
      setUploadingPawnSlip(false)
    }
  }

  async function handleBypassPrepaid() {
    if (!window.confirm('ยืนยันว่าฝากเงินไว้ล่วงหน้าแล้ว?')) return
    if (!pawn) return

    setUploadingPawnSlip(true)
    try {
      const pawnUpdate = await supabase.from('pawns').update({ tx_status: 'active' }).eq('id', pawnId)
      assertSupabaseMutation(pawnUpdate, 'อัปเดตสถานะตั๋วไม่สำเร็จ')
      const notificationInsert = await insertNotificationRecord(supabase, {
        type: 'bypass_prepaid',
        message: `ฝากเงินล่วงหน้าแล้ว ตั๋ว #${pawn.ticket_no}`,
        pawn_id: String(pawnId),
        action_url: createNotificationAction(`/pawns/${pawnId}`, [...getNotificationRecipientsForFundOwner((pawn.fund_owner as 'tony' | 'louise' | 'phat') || 'tony')]),
      })
      assertSupabaseMutation(notificationInsert, 'บันทึกการแจ้งเตือนไม่สำเร็จ')
      await pingPushDispatch()
      await loadData()
      showToast({ tone: 'success', title: 'อัปเดตแล้ว', message: 'บันทึกการฝากเงินล่วงหน้าเรียบร้อยแล้ว' })
    } catch (error) {
      showToast({ tone: 'error', title: 'บันทึกไม่สำเร็จ', message: errorMessage(error) })
    } finally {
      setUploadingPawnSlip(false)
    }
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
      {viewImg ? (
        <div onClick={() => setViewImg('')} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.97)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <img src={viewImg} loading="lazy" style={{ maxWidth: '100%', maxHeight: '90dvh', borderRadius: 12, objectFit: 'contain' }} alt="preview" />
          <button onClick={() => setViewImg('')} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 99, width: 44, height: 44, fontSize: 22, cursor: 'pointer' }}>×</button>
          <div style={{ position: 'absolute', bottom: 24, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>แตะเพื่อปิด</div>
        </div>
      ) : null}

      {editingInterest || deletingInterest ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 420, borderRadius: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
              {editingInterest ? 'แก้ไขรายการตัดดอก' : 'ลบรายการตัดดอก'}
            </div>

            {editingInterest ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>จำนวนดอกเบี้ย</div>
                  <input className="input-field" type="number" value={interestForm.amount} onChange={(event) => setInterestForm((current) => ({ ...current, amount: event.target.value }))} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>วันที่ตัดดอก</div>
                  <input className="input-field" type="date" value={interestForm.payment_date} onChange={(event) => setInterestForm((current) => ({ ...current, payment_date: event.target.value }))} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>หมายเหตุ</div>
                  <input className="input-field" value={interestForm.note} onChange={(event) => setInterestForm((current) => ({ ...current, note: event.target.value }))} placeholder="ถ้ามี" />
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12 }}>
                กำลังลบรายการตัดดอก ฿{fmt(deletingInterest?.amount || 0)} วันที่ {deletingInterest ? toThaiDateLong(deletingInterest.payment_date) : '-'}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>เหตุผล / remark</div>
              <input className="input-field" value={actionRemark} onChange={(event) => setActionRemark(event.target.value)} placeholder={`เช่น ${editingInterest ? 'คีย์ยอดผิด' : 'บันทึกซ้ำ'} โดย ${getReadableUserName(user)}`} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button type="button" className="btn-secondary" onClick={closeInterestDialogs} disabled={actionSaving}>ยกเลิก</button>
              <button
                type="button"
                className={deletingInterest ? 'btn-primary' : 'btn-primary'}
                onClick={editingInterest ? submitInterestEdit : submitInterestDelete}
                disabled={actionSaving}
                style={deletingInterest ? { background: 'linear-gradient(180deg, #7B2D2D 0%, #5B1717 100%)', color: '#FFE3E3' } : undefined}
              >
                {actionSaving ? 'กำลังบันทึก...' : editingInterest ? 'บันทึกการแก้ไข' : 'ยืนยันการลบ'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ padding: '56px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/pawns')} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 26, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 22, fontWeight: 800 }}>ตั๋ว #{pawn.ticket_no}</div>
        <span className={headerBadgeClass} style={{ marginLeft: 'auto' }}>
          {headerBadgeLabel}
        </span>
      </div>

      {renewedTo ? (
        <div onClick={() => router.push(`/pawns/${renewedTo.id}`)} style={{ background: 'rgba(242,201,76,0.08)', border: '1px solid rgba(242,201,76,0.28)', borderRadius: 14, padding: '12px 16px', marginBottom: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔗</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>{adjustedType}{' -> '}ตั๋วใหม่ #{renewedTo.ticket_no}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ยอดใหม่ ฿{fmt(renewedTo.amount)}</div>
          </div>
          <span style={{ fontSize: 16, color: 'var(--gold)' }}>›</span>
        </div>
      ) : null}

      {renewedFrom ? (
        <div onClick={() => router.push(`/pawns/${pawn.renewed_from_id}`)} style={{ background: 'rgba(242,201,76,0.06)', border: '1px solid rgba(242,201,76,0.2)', borderRadius: 14, padding: '12px 16px', marginBottom: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔗</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--gold-light)', fontWeight: 600 }}>{cameFromTopup ? 'เพิ่มยอดจากตั๋ว' : 'ลดต้นจากตั๋ว'} #{renewedFrom.ticket_no}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ต้นเดิม ฿{fmt(renewedFrom.amount)} · {cameFromTopup ? 'เพิ่มยอด' : 'ตัดต้น'} ฿{fmt(Math.abs(Number(pawn.renewal_principal_paid) || 0))}</div>
          </div>
          <span style={{ fontSize: 16, color: 'var(--gold-light)' }}>›</span>
        </div>
      ) : null}

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
        {pawn.notes ? <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-secondary)' }}>{pawn.notes}</div> : null}
      </div>

      <PawnChecklist
        pawn={pawn}
        transferSlips={transferSlips}
        interests={interests}
        redemption={redemption}
        onViewImg={setViewImg}
        onUploadPawnSlip={uploadPawnTicketSlip}
        onUploadInterestSlip={uploadInterestSlip}
        onEditInterest={openEditInterest}
        onDeleteInterest={openDeleteInterest}
        onUploadRedemptionSlip={uploadRedemptionSlip}
        onConfirmTransfer={confirmTransfer}
        onBypassCash={handleBypassCash}
        onBypassPrepaid={handleBypassPrepaid}
        uploadingPawnSlip={uploadingPawnSlip}
        uploadingDocKey={uploadingDocKey}
        isOwner={canManageTransfer}
      />

      <ActionAuditPanel audits={audits} />

      {pawn.status === 'active' && pawn.tx_status === 'active' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => router.push(`/interest?pawn_id=${pawnId}`)} className="btn-secondary" style={{ fontSize: 16 }}>ตัดดอก</button>
          <button onClick={() => router.push(`/renew?pawn_id=${pawnId}`)} className="btn-secondary" style={{ fontSize: 16 }}>ลดต้น</button>
          <button onClick={() => router.push(`/topup?pawn_id=${pawnId}`)} className="btn-secondary" style={{ fontSize: 16 }}>เพิ่มยอด</button>
          <button onClick={() => router.push(`/redeem?pawn_id=${pawnId}`)} className="btn-primary" style={{ fontSize: 17 }}>ไถ่ถอน</button>
        </div>
      ) : null}
      <div style={{ height: 32 }} />
    </main>
  )
}
