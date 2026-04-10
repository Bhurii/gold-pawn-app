'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toThaiDateShort, fmt } from '@/lib/utils'

export default function NewPawn() {
  const router = useRouter()
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [aiUsed, setAiUsed] = useState('')
  const [ocrError, setOcrError] = useState('')
  const [existingPawn, setExistingPawn] = useState<any>(null)
  const [form, setForm] = useState({ ticket_no: '', pawn_date: '', amount: '' })

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImage(file)
    setPreview(URL.createObjectURL(file))
    setExistingPawn(null)
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
        const ticketNo = json.data.ticket_no?.toString().trim() || ''
        setForm({
          ticket_no: ticketNo,
          pawn_date: json.data.pawn_date || '',
          amount: json.data.amount?.toString() || ''
        })
        setScanned(true)
        setAiUsed(json.ai_used || '')
        if (ticketNo) await checkExisting(ticketNo)
      } else {
        setOcrError(json.error || 'AI อ่านไม่ได้ กรอกเองได้เลย')
      }
    } catch {
      setOcrError('เชื่อมต่อ AI ไม่ได้ กรอกเองได้เลย')
    } finally {
      setScanning(false)
    }
  }

  async function checkExisting(ticketNo: string) {
    const { data } = await supabase.from('pawns').select('*').eq('ticket_no', ticketNo).single()
    if (data) setExistingPawn(data)
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
        status: 'active',
        tx_status: 'pending_transfer'
      }).select().single()
      if (error) throw error
      await supabase.from('notifications').insert({
        type: 'pawn_created',
        message: `มีคนมาขายห่านจ้า! ตั๋ว #${form.ticket_no} ฿${parseFloat(form.amount).toLocaleString('th-TH')} โอนตังเลย`,
        pawn_id: pawn.id
      })
      alert('บันทึกสำเร็จ! รอชาวสวนโอนเงิน')
      router.push(`/pawns/${pawn.id}`)
    } catch (e: any) {
      alert('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page-container">
      <div style={{ padding: '56px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 26, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 22, fontWeight: 800 }}>🪺 รับฝากห่าน</div>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'var(--gold)' }} />
        <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'var(--border)' }} />
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>Step 1/2</div>
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
        เจ้หลุยอัปตั๋ว → AI อ่านข้อมูล → รอชาวสวนโอนเงิน
      </div>

      {preview ? (
        <div style={{ marginBottom: 16, position: 'relative' }}>
          <img src={preview} alt="slip" style={{ width: '100%', borderRadius: 16, maxHeight: 260, objectFit: 'contain', background: 'var(--black-700)' }} />
          <button onClick={() => { setPreview(''); setImage(null); setScanned(false); setExistingPawn(null) }}
            style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: 99, width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1.5px dashed var(--border-hover)', borderRadius: 16, padding: '20px 12px', cursor: 'pointer', background: 'var(--black-800)' }}>
            <input type="file" accept="image/*" capture="environment" onChange={handleImage} style={{ display: 'none' }} />
            <span style={{ fontSize: 32 }}>📷</span>
            <span style={{ color: 'var(--gold)', fontWeight: 600, fontSize: 15 }}>ถ่ายรูป</span>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1.5px dashed var(--border-hover)', borderRadius: 16, padding: '20px 12px', cursor: 'pointer', background: 'var(--black-800)' }}>
            <input type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
            <span style={{ fontSize: 32 }}>🖼️</span>
            <span style={{ color: 'var(--gold)', fontWeight: 600, fontSize: 15 }}>เลือกจากคลัง</span>
          </label>
        </div>
      )}

      {scanning && (
        <div style={{ background: 'rgba(242,201,76,0.1)', border: '0.5px solid var(--border-hover)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ color: 'var(--gold)', fontSize: 15 }}>⏳ AI กำลังอ่านตั๋ว...</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>ใช้ {aiUsed || 'Gemini Flash Lite'}</div>
        </div>
      )}

      {existingPawn && !scanning && (
        <div style={{ background: 'rgba(242,201,76,0.1)', border: '1px solid rgba(242,201,76,0.4)', borderRadius: 16, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)', marginBottom: 10 }}>⚠️ ห่านตัวนี้มีในระบบแล้ว</div>
          <div style={{ fontSize: 15, marginBottom: 4 }}>ตั๋ว #{existingPawn.ticket_no} · ฿{fmt(existingPawn.amount)}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>{toThaiDateShort(existingPawn.pawn_date)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <button onClick={() => router.push(`/pawns/${existingPawn.id}`)}
              style={{ padding: '10px 8px', borderRadius: 12, border: '1px solid var(--border-hover)', background: 'transparent', color: 'var(--gold)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              📋 ดูข้อมูล
            </button>
            <button onClick={() => router.push(`/interest?pawn_id=${existingPawn.id}`)}
              style={{ padding: '10px 8px', borderRadius: 12, border: '1px solid var(--border-hover)', background: 'transparent', color: '#6fcf6f', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              🥚 เก็บไข่
            </button>
            <button onClick={() => router.push(`/redeem?pawn_id=${existingPawn.id}`)}
              style={{ padding: '10px 8px', borderRadius: 12, border: '1px solid var(--border-hover)', background: 'transparent', color: '#f09595', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              🐣 คืนห่าน
            </button>
          </div>
        </div>
      )}

      {scanned && !scanning && !existingPawn && (
        <div style={{ background: 'rgba(21,82,40,0.4)', border: '0.5px solid rgba(97,196,89,0.3)', borderRadius: 14, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ color: '#6fcf6f', fontSize: 14 }}>✓ AI อ่านตั๋วแล้ว — ตรวจสอบข้อมูลด้านล่าง</div>
          {aiUsed && <div style={{ color: 'rgba(111,207,111,0.6)', fontSize: 12, marginTop: 4 }}>ใช้: {aiUsed}</div>}
        </div>
      )}

      {ocrError && !scanning && (
        <div style={{ background: 'rgba(162,45,45,0.3)', border: '0.5px solid rgba(240,149,149,0.3)', borderRadius: 14, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ color: '#F09595', fontSize: 14 }}>⚠️ {ocrError}</div>
        </div>
      )}

      {!existingPawn && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>เลขที่ตั๋ว</div>
              <input className="input-field" placeholder="เช่น 23779"
                value={form.ticket_no}
                onChange={async e => {
                  setForm({ ...form, ticket_no: e.target.value })
                  if (e.target.value.length > 3) await checkExisting(e.target.value)
                }} />
            </div>
            <div>
              <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>วันที่จำนำ</div>
              <input className="input-field" type="date"
                value={form.pawn_date} onChange={e => setForm({ ...form, pawn_date: e.target.value })} />
              {form.pawn_date && <div style={{ fontSize: 13, color: 'var(--gold)', marginTop: 6 }}>{toThaiDateShort(form.pawn_date)}</div>}
            </div>
            <div>
              <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>จำนวนเงิน (บาท)</div>
              <input className="input-field" type="number" placeholder="เช่น 31000"
                value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
          </div>
          <div style={{ marginTop: 24 }}>
            <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: 18 }}>
              {saving ? 'กำลังบันทึก...' : '🪺 บันทึกรับฝากห่าน'}
            </button>
          </div>
        </>
      )}
      <div style={{ height: 32 }} />
    </main>
  )
}
