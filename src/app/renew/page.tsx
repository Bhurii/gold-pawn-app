'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/components/ToastProvider'
import { type FundOwnerKey } from '@/lib/fund-owner'
import { pingPushDispatch } from '@/lib/push-client'
import { uploadSlip } from '@/lib/slip-storage'
import ThaiDatePicker from '@/components/ThaiDatePicker'
import { fmt, toThaiDateLong } from '@/lib/utils'
import { errorMessage, parseNonNegativeMoney, requireDate } from '@/lib/validation'

type PawnRow = {
  id: string
  ticket_no: string
  pawn_date: string
  amount: number
  notes?: string
  fund_owner?: FundOwnerKey
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
    if (pawnIdFromUrl) void loadPawn(pawnIdFromUrl)
  }, [pawnIdFromUrl])

  async function loadPawn(id: string) {
    setLoading(true)
    try {
      const response = await fetch(`/api/pawns/${encodeURIComponent(id)}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || 'โหลดข้อมูลตั๋วไม่สำเร็จ')
      setPawn((payload?.pawn as PawnRow | null) || null)
    } catch {
      setPawn(null)
    } finally {
      setLoading(false)
    }
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

  async function handleSave() {
    if (!pawn) return
    if (!form.new_ticket_no) {
      showToast({ tone: 'error', title: 'ข้อมูลยังไม่ครบ', message: 'กรุณาใส่เลขตั๋วใหม่' })
      return
    }
    if (!form.interest && !form.principal_paid) {
      showToast({ tone: 'error', title: 'ข้อมูลยังไม่ครบ', message: 'กรุณาใส่ยอดดอกหรือยอดต้นที่ลด' })
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
        throw new Error('ยอดต้นใหม่ต้องมากกว่า 0')
      }

      const newTicketUrl = newTicketImage ? await uploadSlip(newTicketImage, 'pawns') : ''
      const transferUrl = transferImage ? await uploadSlip(transferImage, 'interest') : ''

      const response = await fetch('/api/pawn-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'renew',
          pawn_id: pawn.id,
          old_ticket_no: pawn.ticket_no,
          old_amount: pawn.amount,
          previous_notes: pawn.notes || '',
          new_ticket_no: form.new_ticket_no,
          new_date: newDate,
          new_amount: newAmount,
          interest,
          principal_paid: principalPaid,
          fund_owner: pawn.fund_owner || 'tony',
          new_ticket_url: newTicketUrl,
          transfer_url: transferUrl,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'บันทึกรายการลดต้นไม่สำเร็จ')
      }

      await pingPushDispatch()
      showToast({ tone: 'success', title: 'ลดต้นสำเร็จ', message: `ตั๋วใหม่ #${form.new_ticket_no}\nยอดใหม่ ฿${fmt(newAmount)}` })
      router.replace(`/pawns/${payload.pawnId}`)
    } catch (e) {
      showToast({ tone: 'error', title: 'บันทึกไม่สำเร็จ', message: errorMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--gold)', fontSize: 18 }}>กำลังโหลด...</div>
  if (!pawn) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>ไม่พบข้อมูลตั๋ว</div>

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
            setDateConfirmed(true)
            setDateConfidence('manual')
            setDateNote('')
          }}
          label="วันที่ออกตั๋วใหม่"
        />

        {dateNote && (
          <div className="card" style={{ padding: 14, borderColor: dateConfirmed ? 'rgba(242,201,76,0.22)' : 'rgba(242,201,76,0.4)' }}>
            <div style={{ fontSize: 13, color: dateConfirmed ? 'var(--text-secondary)' : 'var(--gold-light)' }}>
              {dateConfidence === 'suggested' ? 'วันที่คาดการณ์จาก AI' : dateConfidence === 'clear' ? 'AI อ่านวันที่ได้' : 'ต้องยืนยันวันที่'}: {dateNote}
            </div>
            {!dateConfirmed && (
              <button type="button" className="btn-secondary" style={{ marginTop: 10 }} onClick={() => setDateConfirmed(true)}>
                ยืนยันวันที่นี้
              </button>
            )}
          </div>
        )}

        <div>
          <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>สลิปโอนเงิน (ถ้ามี)</div>
          {transferPreview ? (
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <img src={transferPreview} style={{ width: '100%', borderRadius: 14, maxHeight: 200, objectFit: 'contain', background: 'var(--black-700)', display: 'block' }} alt="transfer" />
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
          {transferOcrNote && (
            <div style={{ marginTop: 8, fontSize: 12, color: transferAmountMismatch ? 'var(--danger-soft)' : 'var(--text-muted)' }}>
              {transferOcrNote}
            </div>
          )}
        </div>

        <div className="panel-gold" style={{ padding: 18 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>สรุปรายการ</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span>ยอดเดิม</span>
            <strong>฿{fmt(pawn.amount)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span>ลดต้น</span>
            <strong>-฿{fmt(principalPaid)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span>ดอกที่เคลียร์</span>
            <strong>฿{fmt(interest)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, color: 'var(--gold)', fontWeight: 800 }}>
            <span>ยอดตั๋วใหม่</span>
            <span>฿{fmt(Math.max(newAmount, 0))}</span>
          </div>
          {ticketAmountMismatch && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger-soft)' }}>
              AI อ่านยอดในตั๋วใหม่เป็น ฿{fmt(ticketOcrAmount || 0)} ซึ่งไม่ตรงกับยอดที่คำนวณได้
            </div>
          )}
          {transferAmountMismatch && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger-soft)' }}>
              AI อ่านยอดสลิปเป็น ฿{fmt(transferOcrAmount || 0)} แต่ยอดที่ควรโอนคือ ฿{fmt(transferExpected)}
            </div>
          )}
        </div>

        <button className="btn-primary" disabled={saving} onClick={handleSave} style={{ fontSize: 18 }}>
          {saving ? 'กำลังบันทึก...' : `ยืนยันลดต้น → ตั๋วใหม่ ฿${fmt(Math.max(newAmount, 0))}`}
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
