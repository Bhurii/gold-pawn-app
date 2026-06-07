'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ToastProvider'
import { toThaiDateShort, fmt } from '@/lib/utils'
import { uploadSlip } from '@/lib/slip-storage'
import { pingPushDispatch } from '@/lib/push-client'
import { errorMessage, parseNonNegativeMoney, requireDate } from '@/lib/validation'

type PawnRow = {
  id: string
  ticket_no: string
  pawn_date: string
  amount: number
}

type InterestPayment = {
  amount: number
}

function RedeemContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const pawnIdFromUrl = searchParams.get('pawn_id')
  const [pawns, setPawns] = useState<PawnRow[]>([])
  const [selected, setSelected] = useState<PawnRow | null>(null)
  const [step, setStep] = useState<'select' | 'upload'>(pawnIdFromUrl ? 'upload' : 'select')
  const [loadingPawn, setLoadingPawn] = useState(Boolean(pawnIdFromUrl))
  const [pawnImage, setPawnImage] = useState<File | null>(null)
  const [pawnPreview, setPawnPreview] = useState('')
  const [transferImage, setTransferImage] = useState<File | null>(null)
  const [transferPreview, setTransferPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [interestPayments, setInterestPayments] = useState<InterestPayment[]>([])
  const [form, setForm] = useState({
    redeem_date: new Date().toISOString().split('T')[0],
    interest_last: '',
  })

  useEffect(() => {
    void loadActivePawns()
    if (pawnIdFromUrl) {
      void loadPawnById(pawnIdFromUrl)
    }
  }, [pawnIdFromUrl])

  async function loadPawnById(pawnId: string) {
    setLoadingPawn(true)
    const { data } = await supabase.from('pawns').select('id, ticket_no, pawn_date, amount').eq('id', pawnId).single()
    if (data) {
      const pawn = data as PawnRow
      setSelected(pawn)
      await loadInterests(pawn.id)
      setStep('upload')
    }
    setLoadingPawn(false)
  }

  async function loadActivePawns() {
    const { data } = await supabase
      .from('pawns')
      .select('id, ticket_no, pawn_date, amount')
      .eq('status', 'active')
      .eq('tx_status', 'active')
      .order('created_at', { ascending: false })
    if (data) setPawns(data as PawnRow[])
  }

  async function loadInterests(pawnId: string) {
    const { data } = await supabase.from('interest_payments').select('amount').eq('pawn_id', pawnId)
    if (data) setInterestPayments(data as InterestPayment[])
  }

  async function selectPawn(pawn: PawnRow) {
    setSelected(pawn)
    await loadInterests(pawn.id)
    setStep('upload')
  }

  async function uploadImage(file: File, folder: string) {
    return uploadSlip(file, folder)
  }

  async function handleSave() {
    if (!selected || !form.redeem_date) {
      showToast({ tone: 'error', title: 'ข้อมูลยังไม่ครบ', message: 'กรุณากรอกข้อมูลให้ครบ' })
      return
    }

    setSaving(true)
    try {
      const pawnSlipUrl = pawnImage ? await uploadImage(pawnImage, 'redeem-pawn') : ''
      const transferSlipUrl = transferImage ? await uploadImage(transferImage, 'redeem-transfer') : ''
      const redeemDate = requireDate(form.redeem_date, 'Redeem date')
      const interestLast = parseNonNegativeMoney(form.interest_last, 'Last interest')
      const interestPaid = interestPayments.reduce((sum, item) => sum + item.amount, 0)
      const interestTotal = interestPaid + interestLast

      const { error } = await supabase.from('redemptions').insert({
        pawn_id: selected.id,
        redeem_date: redeemDate,
        interest_last: interestLast,
        interest_total: interestTotal,
        total_return: selected.amount + interestTotal,
        pawn_slip_url: pawnSlipUrl,
        transfer_slip_url: transferSlipUrl,
        status: 'pending_confirm',
      })
      if (error) throw error

      await supabase.from('pawns').update({ tx_status: 'pending_redeem' }).eq('id', selected.id)
      await supabase.from('notifications').insert({
        type: 'redeem_pending',
        message: `ขายห่านได้แล้ว! ตั๋ว #${selected.ticket_no} ดอก ฿${fmt(interestTotal)} รอชาวสวนยืนยัน`,
        pawn_id: selected.id,
      })
      await pingPushDispatch()

      showToast({ tone: 'success', title: 'ส่งคำขอแล้ว', message: 'รอชาวสวนยืนยันการคืนห่าน' })
      router.push('/')
    } catch (e) {
      showToast({ tone: 'error', title: 'บันทึกไม่สำเร็จ', message: errorMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  const interestPaid = interestPayments.reduce((sum, item) => sum + item.amount, 0)
  const interestLast = Number(form.interest_last) || 0
  const interestTotal = interestPaid + interestLast

  if (loadingPawn) {
    return (
      <main className="page-container">
        <div style={{ padding: '56px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push(selected ? `/pawns/${selected.id}` : '/pawns')} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 26, cursor: 'pointer' }}>←</button>
          <div style={{ fontSize: 22, fontWeight: 800 }}>คืนห่าน</div>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40, fontSize: 16 }}>กำลังโหลด...</div>
      </main>
    )
  }

  if (step === 'select') {
    return (
      <main className="page-container">
        <div style={{ padding: '56px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/pawns')} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 26, cursor: 'pointer' }}>←</button>
          <div style={{ fontSize: 22, fontWeight: 800 }}>คืนห่าน</div>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>เลือกห่านที่จะคืน</div>
        {pawns.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40, fontSize: 16 }}>ไม่มีห่านในฝูง</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pawns.map((pawn) => (
              <div key={pawn.id} className="card" onClick={() => void selectPawn(pawn)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(242,201,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🐣</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>ตั๋ว #{pawn.ticket_no}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{toThaiDateShort(pawn.pawn_date)}</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--gold)' }}>฿{fmt(pawn.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </main>
    )
  }

  return (
    <main className="page-container">
      <div style={{ padding: '56px 0 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => (pawnIdFromUrl && selected ? router.push(`/pawns/${selected.id}`) : setStep('select'))} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 26, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 20, fontWeight: 800 }}>คืนห่าน #{selected?.ticket_no}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'var(--gold)' }} />
        <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'var(--border)' }} />
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>Step 1/2</div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        เจ้หลุยอัปข้อมูล → รอชาวสวนยืนยัน
      </div>

      <div className="panel-gold" style={{ borderRadius: 18, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>เงินต้น</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--gold)' }}>฿{fmt(selected?.amount || 0)}</div>
        {interestPayments.length > 0 && (
          <div style={{ fontSize: 13, color: 'var(--gold-light)', marginTop: 6 }}>
            เก็บไข่แล้ว {interestPayments.length} ครั้ง รวม ฿{fmt(interestPaid)}
          </div>
        )}
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>1. อัปรูปตั๋วจำนำ (ถ้ามี)</div>
      {pawnPreview ? (
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <img src={pawnPreview} style={{ width: '100%', borderRadius: 14, maxHeight: 180, objectFit: 'contain', background: 'var(--black-800)', display: 'block' }} alt="pawn" />
          <button onClick={() => { setPawnPreview(''); setPawnImage(null) }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: 99, width: 30, height: 30, cursor: 'pointer' }}>×</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '14px', cursor: 'pointer', background: 'var(--black-800)' }}>
            <input type="file" accept="image/*" capture="environment" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setPawnImage(file); setPawnPreview(URL.createObjectURL(file)) } }} style={{ display: 'none' }} />
            <span style={{ fontSize: 26 }}>📷</span><span style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>ถ่ายรูป</span>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '14px', cursor: 'pointer', background: 'var(--black-800)' }}>
            <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setPawnImage(file); setPawnPreview(URL.createObjectURL(file)) } }} style={{ display: 'none' }} />
            <span style={{ fontSize: 26 }}>🖼️</span><span style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>เลือกจากคลัง</span>
          </label>
        </div>
      )}

      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>2. สลิปโอนเงินคืน</div>
      {transferPreview ? (
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <img src={transferPreview} style={{ width: '100%', borderRadius: 14, maxHeight: 180, objectFit: 'contain', background: 'var(--black-800)', display: 'block' }} alt="transfer" />
          <button onClick={() => { setTransferPreview(''); setTransferImage(null) }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: 99, width: 30, height: 30, cursor: 'pointer' }}>×</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '14px', cursor: 'pointer', background: 'var(--black-800)' }}>
            <input type="file" accept="image/*" capture="environment" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setTransferImage(file); setTransferPreview(URL.createObjectURL(file)) } }} style={{ display: 'none' }} />
            <span style={{ fontSize: 26 }}>📷</span><span style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>ถ่ายรูป</span>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '14px', cursor: 'pointer', background: 'var(--black-800)' }}>
            <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setTransferImage(file); setTransferPreview(URL.createObjectURL(file)) } }} style={{ display: 'none' }} />
            <span style={{ fontSize: 26 }}>🖼️</span><span style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>เลือกจากคลัง</span>
          </label>
        </div>
      )}

      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>3. ดอกเบี้ยงวดสุดท้าย</div>
      <input className="input-field" type="number" placeholder="฿ จำนวนดอก" value={form.interest_last} onChange={(e) => setForm({ ...form, interest_last: e.target.value })} style={{ marginBottom: 12 }} />
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>วันที่คืนห่าน</div>
      <input className="input-field" type="date" value={form.redeem_date} onChange={(e) => setForm({ ...form, redeem_date: e.target.value })} style={{ marginBottom: 16 }} />

      <div className="card" style={{ background: '#0A0A0A', borderRadius: 16, padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>สรุปไข่ทั้งหมด</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>
          <span>เก็บไข่แล้ว</span><span style={{ color: 'var(--gold-light)' }}>฿{fmt(interestPaid)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
          <span>ไข่งวดสุดท้าย</span><span style={{ color: 'var(--gold-light)' }}>฿{fmt(interestLast)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, borderTop: '0.5px solid rgba(242,201,76,0.2)', paddingTop: 12 }}>
          <span style={{ color: 'var(--text-muted)' }}>ไข่รวมทั้งหมด</span>
          <span style={{ color: 'var(--gold)' }}>฿{fmt(interestTotal)}</span>
        </div>
      </div>

      <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: 18 }}>
        {saving ? 'กำลังบันทึก...' : 'ส่งให้ชาวสวนยืนยัน'}
      </button>
      <div style={{ height: 32 }} />
    </main>
  )
}

export default function RedeemPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--gold)', padding: 40, textAlign: 'center', fontSize: 18 }}>กำลังโหลด...</div>}>
      <RedeemContent />
    </Suspense>
  )
}
