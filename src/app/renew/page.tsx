'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ToastProvider'
import { createNotificationAction } from '@/lib/notification-meta'
import { toThaiDateLong, fmt } from '@/lib/utils'
import ThaiDatePicker from '@/components/ThaiDatePicker'
import { uploadSlip } from '@/lib/slip-storage'
import { pingPushDispatch } from '@/lib/push-client'
import { errorMessage, parseNonNegativeMoney, requireDate } from '@/lib/validation'

type PawnRow = {
  id: string
  ticket_no: string
  pawn_date: string
  amount: number
  notes?: string
}

type OcrTicketData = {
  ticket_no?: string
  pawn_date?: string
  amount?: number
  date_confidence?: 'clear' | 'suggested' | 'unknown'
  date_note?: string
}

type TransferOcrData = {
  amount?: number
  transfer_date?: string
  transfer_time?: string
  receiver_name?: string
  notes?: string
}

function RenewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const pawnIdFromUrl = searchParams.get('pawn_id')

  const [pawn, setPawn] = useState<PawnRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [newTicketImage, setNewTicketImage] = useState<File | null>(null)
  const [newTicketPreview, setNewTicketPreview] = useState('')
  const [transferImage, setTransferImage] = useState<File | null>(null)
  const [transferPreview, setTransferPreview] = useState('')
  const [dateConfidence, setDateConfidence] = useState<'clear' | 'suggested' | 'unknown' | 'manual'>('manual')
  const [dateNote, setDateNote] = useState('')
  const [dateConfirmed, setDateConfirmed] = useState(true)
  const [ticketOcrAmount, setTicketOcrAmount] = useState<number | null>(null)
  const [transferOcrAmount, setTransferOcrAmount] = useState<number | null>(null)
  const [transferOcrNote, setTransferOcrNote] = useState('')
  const [form, setForm] = useState({
    principal_paid: '',
    interest: '',
    new_ticket_no: '',
    new_date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    if (pawnIdFromUrl) {
      void loadPawn(pawnIdFromUrl)
    }
  }, [pawnIdFromUrl])

  async function loadPawn(id: string) {
    const { data } = await supabase.from('pawns').select('id, ticket_no, pawn_date, amount, notes').eq('id', id).maybeSingle()
    if (data) setPawn(data as PawnRow)
    setLoading(false)
  }

  function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  function applyScanData(scan: OcrTicketData) {
    if (scan.ticket_no) {
      setForm((current) => ({ ...current, new_ticket_no: scan.ticket_no || current.new_ticket_no }))
    }
    if (typeof scan.amount === 'number' && Number.isFinite(scan.amount) && scan.amount > 0) {
      setTicketOcrAmount(scan.amount)
    } else {
      setTicketOcrAmount(null)
    }

    if (scan.pawn_date) {
      setForm((current) => ({ ...current, new_date: scan.pawn_date || current.new_date }))
    }

    if (scan.date_confidence === 'suggested') {
      setDateConfidence('suggested')
      setDateConfirmed(false)
      setDateNote(scan.date_note || 'AI ใช้วันที่ปัจจุบันช่วยวิเคราะห์วันที่บนตั๋วใหม่')
    } else if (scan.date_confidence === 'clear') {
      setDateConfidence('clear')
      setDateConfirmed(true)
      setDateNote(scan.date_note || 'AI อ่านวันที่บนตั๋วใหม่ได้')
    } else if (scan.date_confidence === 'unknown') {
      setDateConfidence('unknown')
      setDateConfirmed(false)
      setDateNote(scan.date_note || 'AI อ่านวันที่ไม่ชัด กรุณายืนยันหรือแก้เอง')
    }
  }

  async function scanNewTicket(file: File) {
    setScanning(true)
    try {
      const base64 = await toBase64(file)
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType: file.type, mode: 'ticket' }),
      })
      const json = await res.json()
      if (json.success && json.data) {
        applyScanData(json.data as OcrTicketData)
      }
    } catch {
      setDateConfidence('unknown')
      setDateConfirmed(false)
      setDateNote('AI อ่านข้อมูลไม่สำเร็จ ลองกรอกวันที่เองได้เลย')
    } finally {
      setScanning(false)
    }
  }

  async function scanTransferSlip(file: File) {
    try {
      const base64 = await toBase64(file)
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType: file.type, mode: 'transfer' }),
      })
      const json = await res.json()
      if (json.success && json.data) {
        const data = json.data as TransferOcrData
        setTransferOcrAmount(typeof data.amount === 'number' && Number.isFinite(data.amount) ? data.amount : null)
        setTransferOcrNote(data.notes || '')
      } else {
        setTransferOcrAmount(null)
        setTransferOcrNote(json.error || '')
      }
    } catch {
      setTransferOcrAmount(null)
      setTransferOcrNote('AI อ่านสลิปไม่สำเร็จ')
    }
  }

  async function uploadImage(file: File, folder: string) {
    return uploadSlip(file, folder)
  }

  async function handleSave() {
    if (!pawn) return
    if (!form.new_ticket_no) {
      showToast({ tone: 'error', title: 'ข้อมูลยังไม่ครบ', message: 'กรุณาใส่เลขตั๋วใหม่' })
      return
    }
    if (!form.interest && !form.principal_paid) {
      showToast({ tone: 'error', title: 'ข้อมูลยังไม่ครบ', message: 'กรุณาใส่ยอดดอกหรือยอดต้น' })
      return
    }
    if (!dateConfirmed) {
      showToast({ tone: 'error', title: 'ต้องยืนยันวันที่ก่อน', message: 'กรุณายืนยันหรือแก้วันที่ของตั๋วใหม่ก่อนบันทึก' })
      return
    }

    setSaving(true)
    try {
      const interest = parseNonNegativeMoney(form.interest, 'Interest')
      const principalPaid = parseNonNegativeMoney(form.principal_paid, 'Principal paid')
      const newDate = requireDate(form.new_date, 'New ticket date')
      const newAmount = pawn.amount - principalPaid

      if (newAmount <= 0) {
        showToast({ tone: 'error', title: 'ยอดไม่ถูกต้อง', message: 'ยอดต้นใหม่ต้องมากกว่า 0' })
        setSaving(false)
        return
      }

      const newTicketUrl = newTicketImage ? await uploadImage(newTicketImage, 'pawns') : ''
      const transferUrl = transferImage ? await uploadImage(transferImage, 'interest') : ''

      const { data: newPawn, error } = await supabase.from('pawns').insert({
        ticket_no: form.new_ticket_no,
        pawn_date: newDate,
        amount: newAmount,
        pawn_slip_url: newTicketUrl,
        status: 'active',
        tx_status: 'active',
        renewed_from_id: pawn.id,
        renewal_interest: interest,
        renewal_principal_paid: principalPaid,
        notes: `ต่อจากตั๋ว #${pawn.ticket_no}`,
      }).select().single()
      if (error) throw error

      await supabase.from('pawns').update({
        status: 'redeemed',
        tx_status: 'redeemed',
        notes: pawn.notes ? `${pawn.notes} | ลดต้น -> ตั๋วใหม่ #${form.new_ticket_no}` : `ลดต้น -> ตั๋วใหม่ #${form.new_ticket_no}`,
      }).eq('id', pawn.id)

      await supabase.from('redemptions').insert({
        pawn_id: pawn.id,
        redeem_date: newDate,
        interest_last: interest,
        interest_total: interest,
        total_return: pawn.amount + interest,
        pawn_slip_url: newTicketUrl,
        transfer_slip_url: transferUrl,
        status: 'confirmed',
      })

      if (transferUrl) {
        await supabase.from('transfer_slips').insert({
          pawn_id: newPawn.id,
          direction: 'me_to_mom',
          slip_url: transferUrl,
          amount: interest + principalPaid,
          confirmed_at: new Date().toISOString(),
        })
      }

      await supabase.from('notifications').insert({
        type: 'renewed',
        message: `ลดต้นตั๋ว #${pawn.ticket_no} -> ตั๋วใหม่ #${form.new_ticket_no} ยอด ฿${fmt(newAmount)}`,
        pawn_id: newPawn.id,
        action_url: createNotificationAction(`/pawns/${newPawn.id}`, ['owner']),
      })
      await pingPushDispatch()

      showToast({ tone: 'success', title: 'ลดต้นสำเร็จ', message: `ตั๋วใหม่ #${form.new_ticket_no}\nยอดใหม่ ฿${fmt(newAmount)}` })
      router.replace(`/pawns/${newPawn.id}`)
    } catch (e) {
      showToast({ tone: 'error', title: 'บันทึกไม่สำเร็จ', message: errorMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--gold)', fontSize: 18 }}>กำลังโหลด...</div>
  if (!pawn) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>ไม่พบข้อมูล</div>

  const interest = Number(form.interest) || 0
  const principalPaid = Number(form.principal_paid) || 0
  const newAmount = pawn.amount - principalPaid
  const transferExpected = interest + principalPaid
  const ticketAmountMismatch = ticketOcrAmount !== null && principalPaid > 0 && ticketOcrAmount !== newAmount
  const transferAmountMismatch = transferOcrAmount !== null && transferExpected > 0 && transferOcrAmount !== transferExpected

  return (
    <main className="page-container">
      <div style={{ padding: '56px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push(`/pawns/${pawn.id}`)} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 26, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 22, fontWeight: 800 }}>ลดต้น</div>
      </div>

      <div className="panel-gold" style={{ borderRadius: 18, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>ตั๋วเดิม</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>#{pawn.ticket_no}</div>
        <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 4 }}>
          {toThaiDateLong(pawn.pawn_date)} · ฿{fmt(pawn.amount)}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>ยอดต้นที่ลด (บาท)</div>
          <input className="input-field" type="number" placeholder="เช่น 5000" value={form.principal_paid} onChange={(e) => setForm({ ...form, principal_paid: e.target.value })} />
        </div>

        <div>
          <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>ดอกเบี้ยที่เคลียร์ใบเก่า (บาท)</div>
          <input className="input-field" type="number" placeholder="เช่น 600" value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })} />
        </div>

        <div>
          <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>รูปตั๋วใหม่ / รูปคู่ตั๋ว</div>
          {newTicketPreview ? (
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <img src={newTicketPreview} style={{ width: '100%', borderRadius: 14, maxHeight: 200, objectFit: 'contain', background: 'var(--black-700)', display: 'block' }} alt="new ticket" />
              <button onClick={() => { setNewTicketPreview(''); setNewTicketImage(null); setTicketOcrAmount(null) }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: 99, width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>×</button>
              {scanning && <div style={{ textAlign: 'center', color: 'var(--gold)', fontSize: 13, marginTop: 6 }}>AI กำลังอ่านข้อมูลตั๋วใหม่...</div>}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '14px', cursor: 'pointer', background: 'var(--black-800)' }}>
                <input type="file" accept="image/*" capture="environment" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setNewTicketImage(file); setNewTicketPreview(URL.createObjectURL(file)); void scanNewTicket(file) } }} style={{ display: 'none' }} />
                <span style={{ fontSize: 26 }}>📷</span><span style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>ถ่ายรูป</span>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '14px', cursor: 'pointer', background: 'var(--black-800)' }}>
                <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setNewTicketImage(file); setNewTicketPreview(URL.createObjectURL(file)); void scanNewTicket(file) } }} style={{ display: 'none' }} />
                <span style={{ fontSize: 26 }}>🖼️</span><span style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>เลือกจากคลัง</span>
              </label>
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>เลขตั๋วใหม่</div>
          <input className="input-field" placeholder="AI จะอ่านให้ หรือกรอกเอง" value={form.new_ticket_no} onChange={(e) => setForm({ ...form, new_ticket_no: e.target.value })} />
        </div>

        <ThaiDatePicker
          value={form.new_date}
          onChange={(value) => {
            setForm({ ...form, new_date: value })
            setDateConfidence('manual')
            setDateConfirmed(true)
            setDateNote('ยืนยันวันที่ด้วยตนเองแล้ว')
          }}
          label="วันที่ในตั๋วใหม่"
        />

        {dateConfidence !== 'manual' && (
          <div style={{ background: dateConfidence === 'suggested' ? 'rgba(242,201,76,0.08)' : 'rgba(242,201,76,0.05)', border: `1px solid ${dateConfidence === 'suggested' ? 'rgba(242,201,76,0.28)' : 'rgba(242,201,76,0.18)'}`, borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: dateConfidence === 'suggested' ? 'var(--gold)' : 'var(--gold-light)', marginBottom: 6 }}>
              {dateConfidence === 'clear' ? 'AI อ่านวันที่บนตั๋วได้' : dateConfidence === 'suggested' ? 'AI แนะนำวันที่จากบริบท' : 'AI อ่านวันที่ไม่ชัด'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>{dateNote || 'กรุณาตรวจสอบวันที่ก่อนบันทึก'}</div>
            {dateConfidence === 'suggested' && !dateConfirmed && (
              <button type="button" className="btn-secondary" onClick={() => setDateConfirmed(true)} style={{ fontSize: 14 }}>
                ใช้วันที่นี้
              </button>
            )}
          </div>
        )}

        <div className="card" style={{ background: '#0A0A0A', borderRadius: 14, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>
            <span>ยอดต้นเดิม</span><span>฿{fmt(pawn.amount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>
            <span>ต้นที่ลด</span><span style={{ color: 'var(--gold-light)' }}>-฿{fmt(principalPaid)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 10 }}>
            <span>ดอกที่เคลียร์</span><span style={{ color: 'var(--gold-light)' }}>-฿{fmt(interest)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, borderTop: '0.5px solid rgba(242,201,76,0.2)', paddingTop: 10 }}>
            <span style={{ color: 'var(--text-muted)' }}>ยอดตั๋วใหม่</span>
            <span style={{ color: newAmount > 0 ? 'var(--gold)' : 'var(--danger-soft)' }}>฿{fmt(Math.max(newAmount, 0))}</span>
          </div>
          {ticketOcrAmount !== null && (
            <div style={{ marginTop: 10, fontSize: 13, color: ticketAmountMismatch ? 'var(--danger-soft)' : 'var(--gold-light)' }}>
              {ticketAmountMismatch ? `AI อ่านยอดจากรูปตั๋วได้ ฿${fmt(ticketOcrAmount)} ซึ่งไม่ตรงกับยอดใหม่ที่คำนวณ` : `AI อ่านยอดจากรูปตั๋วตรงกับยอดใหม่ ฿${fmt(ticketOcrAmount)}`}
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>สลิปโอนเงิน (ควรเป็นยอด ต้นที่ลด + ดอก)</div>
          {transferPreview ? (
            <div style={{ position: 'relative' }}>
              <img src={transferPreview} style={{ width: '100%', borderRadius: 14, maxHeight: 180, objectFit: 'contain', background: 'var(--black-700)', display: 'block' }} alt="slip" />
              <button onClick={() => { setTransferPreview(''); setTransferImage(null); setTransferOcrAmount(null); setTransferOcrNote('') }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: 99, width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '14px', cursor: 'pointer', background: 'var(--black-800)' }}>
                <input type="file" accept="image/*" capture="environment" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setTransferImage(file); setTransferPreview(URL.createObjectURL(file)); void scanTransferSlip(file) } }} style={{ display: 'none' }} />
                <span style={{ fontSize: 26 }}>📷</span><span style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>ถ่ายรูป</span>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '14px', cursor: 'pointer', background: 'var(--black-800)' }}>
                <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setTransferImage(file); setTransferPreview(URL.createObjectURL(file)); void scanTransferSlip(file) } }} style={{ display: 'none' }} />
                <span style={{ fontSize: 26 }}>🖼️</span><span style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>เลือกจากคลัง</span>
              </label>
            </div>
          )}
          {transferExpected > 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
              ยอดที่ควรโอนตามงานนี้: ฿{fmt(transferExpected)}
            </div>
          )}
          {transferOcrAmount !== null && (
            <div style={{ fontSize: 13, color: transferAmountMismatch ? 'var(--danger-soft)' : 'var(--gold-light)', marginTop: 8 }}>
              {transferAmountMismatch ? `OCR อ่านยอดสลิปได้ ฿${fmt(transferOcrAmount)} ซึ่งไม่ตรงกับยอดที่ควรโอน` : `OCR อ่านยอดสลิปตรงกับยอดที่ควรโอน ฿${fmt(transferOcrAmount)}`}
            </div>
          )}
          {transferOcrAmount === null && transferOcrNote && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
              {transferOcrNote}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <button className="btn-primary" onClick={handleSave} disabled={saving || newAmount <= 0 || !dateConfirmed} style={{ fontSize: 18 }}>
          {saving ? 'กำลังบันทึก...' : `ยืนยันลดต้น -> ตั๋วใหม่ ฿${fmt(Math.max(newAmount, 0))}`}
        </button>
      </div>
      <div style={{ height: 32 }} />
    </main>
  )
}

export default function RenewPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--gold)', padding: 40, textAlign: 'center', fontSize: 18 }}>กำลังโหลด...</div>}>
      <RenewContent />
    </Suspense>
  )
}
