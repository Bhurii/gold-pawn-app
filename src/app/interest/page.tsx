'use client'
import ThaiDatePicker from '@/components/ThaiDatePicker'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toThaiDateShort, fmt } from '@/lib/utils'

function InterestContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pawnIdFromUrl = searchParams.get('pawn_id')
  const [pawns, setPawns] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    note: ''
  })

  useEffect(() => { loadPawns() }, [])
  useEffect(() => {
    if (pawnIdFromUrl && pawns.length > 0) {
      const p = pawns.find(p => p.id === pawnIdFromUrl)
      if (p) setSelected(p)
    }
  }, [pawnIdFromUrl, pawns])

  async function loadPawns() {
    const { data } = await supabase.from('pawns').select('*').eq('status', 'active').order('created_at', { ascending: false })
    if (data) setPawns(data)
  }

  async function handleSave() {
    if (!selected || !form.amount || !form.payment_date) {
      alert('กรุณาเลือกตั๋วและกรอกข้อมูลให้ครบ')
      return
    }
    setSaving(true)
    try {
      let slip_url = ''
      if (image) {
        const path = `interest/${Date.now()}.${image.name.split('.').pop()}`
        const { error } = await supabase.storage.from('slips').upload(path, image)
        if (!error) {
          const { data } = supabase.storage.from('slips').getPublicUrl(path)
          slip_url = data.publicUrl
        }
      }
      await supabase.from('interest_payments').insert({
        pawn_id: selected.id,
        payment_date: form.payment_date,
        amount: parseFloat(form.amount),
        slip_url,
        note: form.note
      })
      await supabase.from('notifications').insert({
        type: 'interest_paid',
        message: `ตัดดอกตั๋ว #${selected.ticket_no} ฿${parseFloat(form.amount).toLocaleString('th-TH')}`,
        pawn_id: selected.id
      })
      alert('บันทึกการตัดดอกสำเร็จ!')
      router.push(`/pawns/${selected.id}`)
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
        <div style={{ fontSize: 22, fontWeight: 800 }}>ตัดดอกเบี้ย</div>
      </div>

      <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600 }}>เลือกตั๋วจำนำ</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {pawns.map(p => (
          <div key={p.id} onClick={() => setSelected(p)}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 16, cursor: 'pointer', border: `1px solid ${selected?.id === p.id ? 'var(--gold)' : 'var(--border)'}`, background: selected?.id === p.id ? 'rgba(242,201,76,0.1)' : 'var(--black-800)' }}>
            <span style={{ fontSize: 22 }}>💍</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>ตั๋ว #{p.ticket_no}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{toThaiDateShort(p.pawn_date)}</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)' }}>฿{fmt(p.amount)}</div>
            {selected?.id === p.id && <span style={{ fontSize: 18, color: 'var(--gold)' }}>✓</span>}
          </div>
        ))}
      </div>

      {selected && (
        <>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>จำนวนดอกเบี้ย (บาท)</div>
            <input className="input-field" type="number" placeholder="เช่น 600"
              value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>วันที่ตัดดอก</div>
            <input className="input-field" type="date"
              value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>สลิปโอนเงิน</div>
            {preview ? (
              <div style={{ position: 'relative' }}>
                <img src={preview} style={{ width: '100%', borderRadius: 14, maxHeight: 200, objectFit: 'contain', background: 'var(--black-700)' }} alt="slip" />
                <button onClick={() => { setPreview(''); setImage(null) }}
                  style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: 99, width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '18px 12px', cursor: 'pointer', background: 'var(--black-800)' }}>
                  <input type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) { setImage(f); setPreview(URL.createObjectURL(f)) } }} style={{ display: 'none' }} />
                  <span style={{ fontSize: 30 }}>📷</span>
                  <span style={{ color: 'var(--gold)', fontWeight: 600, fontSize: 15 }}>ถ่ายรูป</span>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '18px 12px', cursor: 'pointer', background: 'var(--black-800)' }}>
                  <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setImage(f); setPreview(URL.createObjectURL(f)) } }} style={{ display: 'none' }} />
                  <span style={{ fontSize: 30 }}>🖼️</span>
                  <span style={{ color: 'var(--gold)', fontWeight: 600, fontSize: 15 }}>เลือกจากคลัง</span>
                </label>
              </div>
            )}
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>หมายเหตุ (ถ้ามี)</div>
            <input className="input-field" placeholder="เช่น ตัดดอกเดือน เม.ย. 68"
              value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          </div>
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: 18 }}>
            {saving ? 'กำลังบันทึก...' : '✂️ บันทึกการตัดดอก'}
          </button>
        </>
      )}
      <div style={{ height: 32 }} />
    </main>
  )
}

export default function InterestPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--gold)', padding: 40, textAlign: 'center', fontSize: 18 }}>กำลังโหลด...</div>}>
      <InterestContent />
    </Suspense>
  )
}
