'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function NewPawn() {
  const router = useRouter()
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [form, setForm] = useState({ ticket_no: '', pawn_date: '', amount: '' })

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImage(file)
    setPreview(URL.createObjectURL(file))
    scanImage(file)
  }

  async function scanImage(file: File) {
    setScanning(true)
    try {
      const base64 = await toBase64(file)
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType: file.type })
      })
      const json = await res.json()
      if (json.success) {
        setForm({
          ticket_no: json.data.ticket_no || '',
          pawn_date: json.data.pawn_date || '',
          amount: json.data.amount?.toString() || ''
        })
        setScanned(true)
      }
    } catch {
      alert('OCR ไม่สำเร็จ กรุณากรอกข้อมูลเอง')
    } finally {
      setScanning(false)
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

  async function handleSave() {
    if (!form.ticket_no || !form.pawn_date || !form.amount) {
      alert('กรุณากรอกข้อมูลให้ครบ')
      return
    }
    setSaving(true)
    try {
      let slip_url = ''
      if (image) {
        const path = `pawns/${Date.now()}.${image.name.split('.').pop()}`
        const { error } = await supabase.storage.from('slips').upload(path, image)
        if (!error) {
          const { data } = supabase.storage.from('slips').getPublicUrl(path)
          slip_url = data.publicUrl
        }
      }
      const { data: pawn, error } = await supabase.from('pawns').insert({
        ticket_no: form.ticket_no,
        pawn_date: form.pawn_date,
        amount: parseFloat(form.amount),
        pawn_slip_url: slip_url,
        status: 'active'
      }).select().single()
      if (error) throw error
      await supabase.from('notifications').insert({
        type: 'pawn_created',
        message: `จำนำตั๋ว #${form.ticket_no} ฿${parseFloat(form.amount).toLocaleString('th-TH')} — รอสลิปโอนเงิน`,
        pawn_id: pawn.id
      })
      alert('บันทึกสำเร็จ!')
      router.push('/')
    } catch (e: any) {
      alert('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page-container">
      <div style={{ padding: '52px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 22, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 20, fontWeight: 700 }}>บันทึกจำนำ</div>
      </div>
      <label style={{ display: 'block', border: '1.5px dashed var(--border-hover)', borderRadius: 16, padding: 24, textAlign: 'center', marginBottom: 16, cursor: 'pointer', background: 'var(--surface)' }}>
        <input type="file" accept="image/*" capture="environment" onChange={handleImage} style={{ display: 'none' }} />
        {preview ? (
          <img src={preview} alt="slip" style={{ width: '100%', borderRadius: 12, maxHeight: 240, objectFit: 'contain' }} />
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
            <div style={{ color: 'var(--gold)', fontWeight: 600 }}>ถ่าย หรือ อัปโหลดสลิป</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>AI จะอ่านข้อมูลให้อัตโนมัติ</div>
          </>
        )}
      </label>
      {scanning && (
        <div style={{ background: 'rgba(232,197,90,0.1)', border: '0.5px solid var(--border-hover)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, color: 'var(--gold)', fontSize: 13, textAlign: 'center' }}>
          ⏳ AI กำลังอ่านสลิป...
        </div>
      )}
      {scanned && !scanning && (
        <div style={{ background: 'rgba(21,82,40,0.4)', border: '0.5px solid rgba(97,196,89,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, color: '#97C459', fontSize: 13 }}>
          ✓ AI อ่านสลิปแล้ว — ตรวจสอบข้อมูลด้านล่าง
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>เลขที่ตั๋ว</div>
          <input className="input-field" placeholder="เช่น 4521" value={form.ticket_no} onChange={e => setForm({ ...form, ticket_no: e.target.value })} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>วันที่จำนำ</div>
          <input className="input-field" type="date" value={form.pawn_date} onChange={e => setForm({ ...form, pawn_date: e.target.value })} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>จำนวนเงิน (บาท)</div>
          <input className="input-field" type="number" placeholder="เช่น 15000" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
        </div>
      </div>
      <div style={{ marginTop: 24 }}>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'กำลังบันทึก...' : '💾 บันทึกรายการจำนำ'}
        </button>
      </div>
      <div style={{ height: 32 }} />
    </main>
  )
}
