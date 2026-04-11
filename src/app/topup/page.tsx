'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toThaiDateLong, fmt } from '@/lib/utils'
import ThaiDatePicker from '@/components/ThaiDatePicker'

function TopupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pawnIdFromUrl = searchParams.get('pawn_id')

  const [pawn, setPawn] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [newTicketImage, setNewTicketImage] = useState<File | null>(null)
  const [newTicketPreview, setNewTicketPreview] = useState('')
  const [transferImage, setTransferImage] = useState<File | null>(null)
  const [transferPreview, setTransferPreview] = useState('')
  const [form, setForm] = useState({
    interest: '',
    topup_amount: '',
    new_ticket_no: '',
    new_date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => { if (pawnIdFromUrl) loadPawn(pawnIdFromUrl) }, [pawnIdFromUrl])

  async function loadPawn(id: string) {
    const { data } = await supabase.from('pawns').select('*').eq('id', id).single()
    if (data) setPawn(data)
    setLoading(false)
  }

  async function scanNewTicket(file: File) {
    setScanning(true)
    try {
      const base64 = await toBase64(file)
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType: file.type })
      })
      const json = await res.json()
      if (json.success && json.data.ticket_no) {
        setForm(f => ({ ...f, new_ticket_no: json.data.ticket_no }))
      }
    } catch { }
    finally { setScanning(false) }
  }

  function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function uploadImage(file: File, folder: string) {
    const path = `${folder}/${Date.now()}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('slips').upload(path, file)
    if (error) return ''
    const { data } = supabase.storage.from('slips').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSave() {
    if (!pawn) return
    if (!form.new_ticket_no) { alert('กรุณาใส่เลขตั๋วใหม่'); return }
    if (!form.topup_amount) { alert('กรุณาใส่ยอดที่เพิ่ม'); return }

    setSaving(true)
    try {
      const interest = parseFloat(form.interest) || 0
      const topupAmount = parseFloat(form.topup_amount) || 0
      const newAmount = pawn.amount + topupAmount

      const newTicketUrl = newTicketImage ? await uploadImage(newTicketImage, 'pawns') : ''
      const transferUrl = transferImage ? await uploadImage(transferImage, 'transfer') : ''

      await supabase.from('pawns').update({
        status: 'redeemed',
        tx_status: 'redeemed'
      }).eq('id', pawn.id)

      await supabase.from('redemptions').insert({
        pawn_id: pawn.id,
        redeem_date: form.new_date,
        interest_last: interest,
        interest_total: interest,
        total_return: pawn.amount + interest,
        pawn_slip_url: newTicketUrl,
        transfer_slip_url: transferUrl,
        status: 'confirmed'
      })

      const { data: newPawn, error } = await supabase.from('pawns').insert({
        ticket_no: form.new_ticket_no,
        pawn_date: form.new_date,
        amount: newAmount,
        pawn_slip_url: newTicketUrl,
        status: 'active',
        tx_status: 'pending_transfer',
        renewed_from_id: pawn.id,
        renewal_interest: interest,
        renewal_principal_paid: -topupAmount,
        notes: `เพิ่มยอดจากตั๋ว #${pawn.ticket_no} (+฿${fmt(topupAmount)})`
      }).select().single()

      if (error) throw error

      await supabase.from('notifications').insert({
        type: 'topup',
        message: `เพิ่มยอดตั๋ว #${pawn.ticket_no} → ตั๋วใหม่ #${form.new_ticket_no} ยอด ฿${fmt(newAmount)} รอโอนเงิน ฿${fmt(topupAmount)}`,
        pawn_id: newPawn.id
      })

      alert(`เพิ่มยอดสำเร็จ! ✅\nตั๋วใหม่ #${form.new_ticket_no}\nยอดใหม่ ฿${fmt(newAmount)}\nต้องโอนเพิ่ม ฿${fmt(topupAmount)}`)
      router.replace(`/pawns/${newPawn.id}`)
    } catch (e: any) {
      alert('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--gold)', fontSize: 18 }}>กำลังโหลด...</div>
  if (!pawn) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>ไม่พบข้อมูล</div>

  const interest = parseFloat(form.interest) || 0
  const topupAmount = parseFloat(form.topup_amount) || 0
  const newAmount = pawn.amount + topupAmount

  return (
    <main className="page-container">
      <div style={{ padding: '56px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 26, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 22, fontWeight: 800 }}>💰 เพิ่มยอด</div>
      </div>

      {/* ตั๋วเดิม */}
      <div style={{ background: 'linear-gradient(135deg,#180F00,#2C1A00)', border: '1px solid rgba(242,201,76,0.35)', borderRadius: 18, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>ตั๋วเดิม</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>#{pawn.ticket_no}</div>
        <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 4 }}>
          {toThaiDateLong(pawn.pawn_date)} · ฿{fmt(pawn.amount)}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        <div>
          <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>ดอกเบี้ยที่ตัด (บาท)</div>
          <input className="input-field" type="number" placeholder="เช่น 600 (ถ้ามี)"
            value={form.interest} onChange={e => setForm({ ...form, interest: e.target.value })} />
        </div>

        <div>
          <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>ยอดที่เพิ่ม (บาท)</div>
          <input className="input-field" type="number" placeholder="เช่น 10000"
            value={form.topup_amount} onChange={e => setForm({ ...form, topup_amount: e.target.value })} />
        </div>

        {/* สรุปยอดใหม่ */}
        {topupAmount > 0 && (
          <div style={{ background: '#0A0A0A', border: '1px solid rgba(242,201,76,0.2)', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <span>ยอดต้นเดิม</span><span>฿{fmt(pawn.amount)}</span>
            </div>
            {interest > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>
                <span>ดอกที่ตัด</span><span style={{ color: '#6fcf6f' }}>-฿{fmt(interest)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 10 }}>
              <span>เพิ่มยอด</span><span style={{ color: '#85b7eb' }}>+฿{fmt(topupAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, borderTop: '0.5px solid rgba(242,201,76,0.2)', paddingTop: 10, marginBottom: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>ยอดตั๋วใหม่</span>
              <span style={{ color: 'var(--gold)' }}>฿{fmt(newAmount)}</span>
            </div>
            <div style={{ background: 'rgba(133,183,235,0.1)', border: '1px solid rgba(133,183,235,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#85b7eb' }}>
              💸 ต้องโอนเพิ่ม ฿{fmt(topupAmount)} ให้เจ้หลุย
            </div>
          </div>
        )}

        <ThaiDatePicker value={form.new_date} onChange={v => setForm({ ...form, new_date: v })} label="วันที่ออกตั๋วใหม่" />

        {/* สลิปโอนเงิน */}
        <div>
          <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>สลิปโอนเงินเพิ่ม (ถ้ามี)</div>
          {transferPreview ? (
            <div style={{ position: 'relative' }}>
              <img src={transferPreview} style={{ width: '100%', borderRadius: 14, maxHeight: 180, objectFit: 'contain', background: 'var(--black-700)', display: 'block' }} alt="slip" />
              <button onClick={() => { setTransferPreview(''); setTransferImage(null) }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: 99, width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '14px', cursor: 'pointer', background: 'var(--black-800)' }}>
                <input type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) { setTransferImage(f); setTransferPreview(URL.createObjectURL(f)) } }} style={{ display: 'none' }} />
                <span style={{ fontSize: 26 }}>📷</span><span style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>ถ่ายรูป</span>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '14px', cursor: 'pointer', background: 'var(--black-800)' }}>
                <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setTransferImage(f); setTransferPreview(URL.createObjectURL(f)) } }} style={{ display: 'none' }} />
                <span style={{ fontSize: 26 }}>🖼️</span><span style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>เลือกจากคลัง</span>
              </label>
            </div>
          )}
        </div>

        {/* รูปตั๋วใหม่ */}
        <div>
          <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>รูปตั๋วใหม่</div>
          {newTicketPreview ? (
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <img src={newTicketPreview} style={{ width: '100%', borderRadius: 14, maxHeight: 200, objectFit: 'contain', background: 'var(--black-700)', display: 'block' }} alt="new ticket" />
              <button onClick={() => { setNewTicketPreview(''); setNewTicketImage(null) }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: 99, width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>✕</button>
              {scanning && <div style={{ textAlign: 'center', color: 'var(--gold)', fontSize: 13, marginTop: 6 }}>⏳ AI อ่านเลขตั๋วใหม่...</div>}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '14px', cursor: 'pointer', background: 'var(--black-800)' }}>
                <input type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) { setNewTicketImage(f); setNewTicketPreview(URL.createObjectURL(f)); scanNewTicket(f) } }} style={{ display: 'none' }} />
                <span style={{ fontSize: 26 }}>📷</span><span style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>ถ่ายรูป</span>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '14px', cursor: 'pointer', background: 'var(--black-800)' }}>
                <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setNewTicketImage(f); setNewTicketPreview(URL.createObjectURL(f)); scanNewTicket(f) } }} style={{ display: 'none' }} />
                <span style={{ fontSize: 26 }}>🖼️</span><span style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>เลือกจากคลัง</span>
              </label>
            </div>
          )}
          <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>เลขตั๋วใหม่</div>
          <input className="input-field" placeholder="AI จะอ่านให้ หรือกรอกเอง"
            value={form.new_ticket_no} onChange={e => setForm({ ...form, new_ticket_no: e.target.value })} />
          {form.new_ticket_no && (
            <div style={{ fontSize: 13, color: 'var(--gold)', marginTop: 6 }}>ตั๋วใหม่ #{form.new_ticket_no}</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <button className="btn-primary" onClick={handleSave} disabled={saving || topupAmount <= 0} style={{ fontSize: 18 }}>
          {saving ? 'กำลังบันทึก...' : `💰 ยืนยันเพิ่มยอด → ตั๋วใหม่ ฿${fmt(newAmount)}`}
        </button>
      </div>
      <div style={{ height: 32 }} />
    </main>
  )
}

export default function TopupPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--gold)', padding: 40, textAlign: 'center', fontSize: 18 }}>กำลังโหลด...</div>}>
      <TopupContent />
    </Suspense>
  )
}
