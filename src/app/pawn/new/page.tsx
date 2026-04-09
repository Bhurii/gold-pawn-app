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
  const [aiUsed, setAiUsed] = useState('')
  const [ocrError, setOcrError] = useState('')
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
    setScanned(false)
    setAiUsed('')
    setOcrError('')
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
        setAiUsed(json.ai_used || '')
      } else {
        setOcrError(json.error || 'OCR ไม่สำเร็จ')
        setAiUsed(json.ai_used || '')
      }
    } catch {
      setOcrError('เชื่อมต่อ API ไม่ได้')
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

      {preview ? (
        <div style={{ marginBottom: 16, position: 'relative' }}>
          <img src={preview} alt="slip" style={{ width: '100%', borderRadius: 16, maxHeight: 260, objectFit: 'contain', background: 'var(--surface)' }} />
          <button onClick={() => { setPreview(''); setImage(null); setScanned(false); setAiUsed(''); setOcrError('') }}
            style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: 99, width: 28, height: 28, cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1.5px dashed var(--border-hover)', borderRadius: 16, padding: '20px 12px', cursor: 'pointer', background: 'var(--surface)' }}>
            <input type="file" accept="image/*" capture="environment" onChange={handleImage} style={{ display: 'none' }} />
            <div style={{ fontSize: 32 }}>📷</div>
            <div style={{ color: 'var(--gold)', fontWeight: 600, fontSize: 14 }}>ถ่ายรูป</div>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1.5px dashed var(--border-hover)', borderRadius: 16, padding: '20px 12px', cursor: 'pointer', background: 'var(--surface)' }}>
            <input type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
            <div style={{ fontSize: 32 }}>🖼️</div>
            <div style={{ color: 'var(--gold)', fontWeight: 600, fontSize: 14 }}>เลือกจากคลัง</div>
          </label>
        </div>
      )}

      {/* สถานะ OCR */}
      {scanning && (
        <div style={{ background: 'rgba(232,197,90,0.1)', border: '0.5px solid var(--border-hover)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
          <div style={{ color: 'var(--gold)', marginBottom: 4 }}>⏳ AI กำลังอ่านสลิป...</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>กำลังลอง Gemini 2.0 Flash ก่อน</div>
        </div>
      )}
      {scanned && !scanning && (
        <div style={{ background: 'rgba(21,82,40,0.4)', border: '0.5px solid rgba(97,196,89,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ color: '#97C459', fontSize: 13 }}>✓ อ่านสลิปสำเร็จ — ตรวจสอบข้อมูลด้านล่าง</div>
          {aiUsed && <div style={{ color: 'rgba(151,196,89,0.6)', fontSize: 11, marginTop: 4 }}>ใช้: {aiUsed}</div>}
        </div>
      )}
      {ocrError && !scanning && (
        <div style={{ background: 'rgba(162,45,45,0.3)', border: '0.5px solid rgba(240,149,149,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ color: '#F09595', fontSize: 13 }}>⚠️ OCR ไม่สำเร็จ — กรุณากรอกเอง</div>
          <div style={{ color: 'rgba(240,149,149,0.6)', fontSize: 11, marginTop: 4 }}>Error: {ocrError}</div>
          {aiUsed && <div style={{ color: 'rgba(240,149,149,0.6)', fontSize: 11 }}>ลองใช้: {aiUsed}</div>}
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
