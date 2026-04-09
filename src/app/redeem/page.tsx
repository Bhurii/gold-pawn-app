'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Pawn } from '@/lib/types'

export default function Redeem() {
  const router = useRouter()
  const [pawns, setPawns] = useState<Pawn[]>([])
  const [selected, setSelected] = useState<Pawn | null>(null)
  const [step, setStep] = useState<'select' | 'upload'>('select')
  const [pawnImage, setPawnImage] = useState<File | null>(null)
  const [pawnPreview, setPawnPreview] = useState('')
  const [transferImage, setTransferImage] = useState<File | null>(null)
  const [transferPreview, setTransferPreview] = useState('')
  const [scanning, setScanning] = useState(false)
  const [ticketVerified, setTicketVerified] = useState<'idle' | 'checking' | 'ok' | 'mismatch'>('idle')
  const [scannedTicketNo, setScannedTicketNo] = useState('')
  const [saving, setSaving] = useState(false)
  const [interestPayments, setInterestPayments] = useState<any[]>([])
  const [form, setForm] = useState({
    redeem_date: new Date().toISOString().split('T')[0],
    interest_last: ''
  })

  useEffect(() => { loadActivePawns() }, [])

  async function loadActivePawns() {
    const { data } = await supabase.from('pawns').select('*')
      .eq('status', 'active').order('created_at', { ascending: false })
    if (data) setPawns(data)
  }

  async function selectPawn(pawn: Pawn) {
    setSelected(pawn)
    const { data } = await supabase.from('interest_payments')
      .select('*').eq('pawn_id', pawn.id)
    if (data) setInterestPayments(data)
    setStep('upload')
  }

  function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function scanAndVerify(file: File) {
    if (!selected) return
    setScanning(true)
    setTicketVerified('checking')
    try {
      const base64 = await toBase64(file)
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType: file.type })
      })
      const json = await res.json()
      if (json.success) {
        const scanned = json.data.ticket_no?.toString().trim() || ''
        const expected = selected.ticket_no?.toString().trim() || ''
        setScannedTicketNo(scanned)

        if (json.data.interest_amounts?.length > 0) {
          const last = json.data.interest_amounts[json.data.interest_amounts.length - 1]
          setForm(f => ({ ...f, interest_last: last.amount?.toString() || '' }))
        }

        if (scanned && scanned === expected) {
          setTicketVerified('ok')
        } else if (scanned) {
          setTicketVerified('mismatch')
        } else {
          setTicketVerified('idle')
        }
      }
    } catch {
      setTicketVerified('idle')
    } finally {
      setScanning(false)
    }
  }

  async function uploadImage(file: File, folder: string) {
    const path = `${folder}/${Date.now()}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('slips').upload(path, file)
    if (error) return ''
    const { data } = supabase.storage.from('slips').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSave() {
    if (!selected) return
    if (ticketVerified === 'mismatch') {
      alert(`⚠️ เลขตั๋วไม่ตรงกัน!\nที่เลือก: #${selected.ticket_no}\nในรูป: #${scannedTicketNo}\nกรุณาตรวจสอบอีกครั้ง`)
      return
    }
    setSaving(true)
    try {
      const pawnSlipUrl = pawnImage ? await uploadImage(pawnImage, 'redeem-pawn') : ''
      const transferSlipUrl = transferImage ? await uploadImage(transferImage, 'redeem-transfer') : ''
      const interestLast = parseFloat(form.interest_last) || 0
      const interestPaid = interestPayments.reduce((s, i) => s + i.amount, 0)
      const interestTotal = interestPaid + interestLast

      await supabase.from('redemptions').insert({
        pawn_id: selected.id,
        redeem_date: form.redeem_date,
        interest_last: interestLast,
        interest_total: interestTotal,
        total_return: selected.amount + interestTotal,
        pawn_slip_url: pawnSlipUrl,
        transfer_slip_url: transferSlipUrl
      })
      await supabase.from('pawns').update({ status: 'redeemed' }).eq('id', selected.id)
      await supabase.from('notifications').insert({
        type: 'redeemed',
        message: `ไถ่ถอนตั๋ว #${selected.ticket_no} ดอกเบี้ยรวม ฿${interestTotal.toLocaleString('th-TH')}`,
        pawn_id: selected.id
      })
      alert(`ไถ่ถอนสำเร็จ!\nดอกที่ตัดแล้ว: ฿${interestPaid.toLocaleString('th-TH')}\nดอกงวดสุดท้าย: ฿${interestLast.toLocaleString('th-TH')}\nดอกรวม: ฿${interestTotal.toLocaleString('th-TH')}`)
      router.push('/')
    } catch (e: any) {
      alert('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const interestPaid = interestPayments.reduce((s, i) => s + i.amount, 0)
  const interestLast = parseFloat(form.interest_last) || 0
  const interestTotal = interestPaid + interestLast

  if (step === 'select') return (
    <main className="page-container">
      <div style={{ padding: '52px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 22, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 20, fontWeight: 700 }}>เลือกตั๋วไถ่ถอน</div>
      </div>
      {pawns.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>ไม่มีตั๋วจำนำอยู่</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pawns.map(p => (
            <div key={p.id} className="card" onClick={() => selectPawn(p)}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,197,90,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>💍</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>ตั๋ว #{p.ticket_no}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(p.pawn_date).toLocaleDateString('th-TH')}</div>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--gold)' }}>฿{p.amount.toLocaleString('th-TH')}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  )

  return (
    <main className="page-container">
      <div style={{ padding: '52px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => setStep('select')} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 22, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 20, fontWeight: 700 }}>ไถ่ถอน ตั๋ว #{selected?.ticket_no}</div>
      </div>

      {/* สรุปตั๋ว */}
      <div style={{ background: 'linear-gradient(135deg,#0A2A15,#0F3D1E)', border: '0.5px solid rgba(232,197,90,0.2)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>เงินต้น</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--gold)' }}>฿{selected?.amount.toLocaleString('th-TH')}</div>
        {interestPayments.length > 0 && (
          <div style={{ fontSize: 12, color: '#97C459', marginTop: 4 }}>
            ตัดดอกแล้ว {interestPayments.length} ครั้ง รวม ฿{interestPaid.toLocaleString('th-TH')}
          </div>
        )}
      </div>

      {/* อัปโหลดตั๋วจำนำ + ตรวจสอบ */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
        1. อัปโหลดรูปตั๋วจำนำ
        <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 8, color: 'rgba(232,197,90,0.6)' }}>AI จะตรวจสอบเลขตั๋วให้อัตโนมัติ</span>
      </div>

      {pawnPreview ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ position: 'relative' }}>
            <img src={pawnPreview} alt="pawn" style={{ width: '100%', borderRadius: 12, maxHeight: 200, objectFit: 'contain', background: 'var(--surface)' }} />
            <button onClick={() => { setPawnPreview(''); setPawnImage(null); setTicketVerified('idle'); setScannedTicketNo('') }}
              style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: 99, width: 28, height: 28, cursor: 'pointer' }}>✕</button>
          </div>

          {/* สถานะตรวจสอบ */}
          {ticketVerified === 'checking' && (
            <div style={{ background: 'rgba(232,197,90,0.1)', borderRadius: 10, padding: '10px 14px', marginTop: 8, color: 'var(--gold)', fontSize: 13 }}>
              ⏳ AI กำลังตรวจสอบเลขตั๋ว...
            </div>
          )}
          {ticketVerified === 'ok' && (
            <div style={{ background: 'rgba(21,82,40,0.5)', border: '0.5px solid rgba(97,196,89,0.4)', borderRadius: 10, padding: '10px 14px', marginTop: 8, color: '#97C459', fontSize: 13 }}>
              ✓ เลขตั๋วตรงกัน #{selected?.ticket_no} — ถูกต้อง
            </div>
          )}
          {ticketVerified === 'mismatch' && (
            <div style={{ background: 'rgba(162,45,45,0.3)', border: '0.5px solid rgba(240,149,149,0.4)', borderRadius: 10, padding: '10px 14px', marginTop: 8 }}>
              <div style={{ color: '#F09595', fontSize: 13, fontWeight: 600 }}>⚠️ เลขตั๋วไม่ตรงกัน!</div>
              <div style={{ color: '#F09595', fontSize: 12, marginTop: 4 }}>ที่เลือก: #{selected?.ticket_no} · ในรูป: #{scannedTicketNo}</div>
              <div style={{ color: 'rgba(240,149,149,0.7)', fontSize: 11, marginTop: 4 }}>กรุณาตรวจสอบว่าอัปโหลดรูปตั๋วถูกใบ</div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '16px 8px', cursor: 'pointer', background: 'var(--surface)' }}>
            <input type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) { setPawnImage(f); setPawnPreview(URL.createObjectURL(f)); scanAndVerify(f) } }} style={{ display: 'none' }} />
            <div style={{ fontSize: 28 }}>📷</div>
            <div style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 600 }}>ถ่ายรูป</div>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '16px 8px', cursor: 'pointer', background: 'var(--surface)' }}>
            <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setPawnImage(f); setPawnPreview(URL.createObjectURL(f)); scanAndVerify(f) } }} style={{ display: 'none' }} />
            <div style={{ fontSize: 28 }}>🖼️</div>
            <div style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 600 }}>เลือกจากคลัง</div>
          </label>
        </div>
      )}

      {/* อัปโหลดสลิปโอนเงิน */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, marginTop: 8 }}>2. อัปโหลดสลิปโอนเงิน</div>
      {transferPreview ? (
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <img src={transferPreview} alt="transfer" style={{ width: '100%', borderRadius: 12, maxHeight: 180, objectFit: 'contain', background: 'var(--surface)' }} />
          <button onClick={() => { setTransferPreview(''); setTransferImage(null) }}
            style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: 99, width: 28, height: 28, cursor: 'pointer' }}>✕</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '16px 8px', cursor: 'pointer', background: 'var(--surface)' }}>
            <input type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) { setTransferImage(f); setTransferPreview(URL.createObjectURL(f)) } }} style={{ display: 'none' }} />
            <div style={{ fontSize: 28 }}>📷</div>
            <div style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 600 }}>ถ่ายรูป</div>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '16px 8px', cursor: 'pointer', background: 'var(--surface)' }}>
            <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setTransferImage(f); setTransferPreview(URL.createObjectURL(f)) } }} style={{ display: 'none' }} />
            <div style={{ fontSize: 28 }}>🖼️</div>
            <div style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 600 }}>เลือกจากคลัง</div>
          </label>
        </div>
      )}

      {/* ดอกเบี้ยงวดสุดท้าย */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>3. ดอกเบี้ยงวดสุดท้าย</div>
      <input className="input-field" type="number" placeholder="จำนวนดอกเบี้ย (บาท)"
        value={form.interest_last} onChange={e => setForm({ ...form, interest_last: e.target.value })}
        style={{ marginBottom: 10 }} />
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>วันที่ไถ่ถอน</div>
      <input className="input-field" type="date"
        value={form.redeem_date} onChange={e => setForm({ ...form, redeem_date: e.target.value })}
        style={{ marginBottom: 16 }} />

      {/* สรุปยอด */}
      <div style={{ background: '#0A2A15', borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>สรุปดอกเบี้ย</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
          <span>ตัดดอกแล้ว</span><span style={{ color: '#97C459' }}>฿{interestPaid.toLocaleString('th-TH')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
          <span>ดอกงวดสุดท้าย</span><span style={{ color: '#97C459' }}>฿{interestLast.toLocaleString('th-TH')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, borderTop: '0.5px solid rgba(232,197,90,0.2)', paddingTop: 10 }}>
          <span style={{ color: 'var(--text-muted)' }}>ดอกเบี้ยรวม</span>
          <span style={{ color: 'var(--gold)' }}>฿{interestTotal.toLocaleString('th-TH')}</span>
        </div>
      </div>

      <button className="btn-primary" onClick={handleSave} disabled={saving || ticketVerified === 'mismatch'}
        style={{ opacity: ticketVerified === 'mismatch' ? 0.5 : 1 }}>
        {saving ? 'กำลังบันทึก...' : ticketVerified === 'mismatch' ? '⚠️ เลขตั๋วไม่ตรงกัน' : '✅ ยืนยันไถ่ถอน'}
      </button>
      <div style={{ height: 32 }} />
    </main>
  )
}
