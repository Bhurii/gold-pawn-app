'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/components/ToastProvider'
import { createNotificationAction } from '@/lib/notification-meta'
import { pingPushDispatch } from '@/lib/push-client'
import { assertImageFile, uploadSlip } from '@/lib/slip-storage'
import { supabase } from '@/lib/supabase'
import { fmt, toThaiDateShort } from '@/lib/utils'
import { errorMessage, parsePositiveMoney, requireDate } from '@/lib/validation'

type PawnRow = {
  id: string
  ticket_no: string
  pawn_date: string
  amount: number
}

function InterestContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const pawnIdFromUrl = searchParams.get('pawn_id')
  const [pawns, setPawns] = useState<PawnRow[]>([])
  const [selected, setSelected] = useState<PawnRow | null>(null)
  const [loadingPawns, setLoadingPawns] = useState(true)
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    note: '',
  })

  useEffect(() => {
    void loadPawns()
  }, [pawnIdFromUrl])

  async function loadPawns() {
    setLoadingPawns(true)
    try {
      const params = new URLSearchParams()
      if (pawnIdFromUrl) {
        params.set('id', pawnIdFromUrl)
      } else {
        params.set('filter', 'active')
        params.set('tx_status', 'active')
      }

      const response = await fetch(`/api/pawns?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'โหลดข้อมูลตั๋วไม่สำเร็จ')
      }

      const rows = (payload?.pawns || []) as PawnRow[]
      setPawns(rows)
      if (pawnIdFromUrl) setSelected(rows[0] || null)
    } catch {
      setPawns([])
      if (pawnIdFromUrl) setSelected(null)
    } finally {
      setLoadingPawns(false)
    }
  }

  function handleFile(file: File | undefined) {
    if (!file) return

    try {
      assertImageFile(file)
      setImage(file)
      setPreview(URL.createObjectURL(file))
    } catch (err) {
      showToast({ tone: 'error', title: 'รูปภาพใช้ไม่ได้', message: errorMessage(err) })
    }
  }

  async function handleSave() {
    if (!selected || !form.amount || !form.payment_date) {
      showToast({ tone: 'error', title: 'ข้อมูลยังไม่ครบ', message: 'กรุณาเลือกตั๋วและกรอกข้อมูลให้ครบ' })
      return
    }

    setSaving(true)
    try {
      const amount = parsePositiveMoney(form.amount, 'Interest amount')
      const paymentDate = requireDate(form.payment_date, 'Payment date')
      const slipUrl = image ? await uploadSlip(image, 'interest') : ''

      await supabase.from('interest_payments').insert({
        pawn_id: selected.id,
        payment_date: paymentDate,
        amount,
        slip_url: slipUrl,
        note: form.note,
      })

      await supabase.from('notifications').insert({
        type: 'interest_paid',
        message: `ตัดดอกตั๋ว #${selected.ticket_no} ฿${amount.toLocaleString('th-TH')}`,
        pawn_id: selected.id,
        action_url: createNotificationAction(`/pawns/${selected.id}`, ['owner']),
      })
      await pingPushDispatch()

      showToast({ tone: 'success', title: 'บันทึกสำเร็จ', message: 'บันทึกการตัดดอกเรียบร้อยแล้ว' })
      router.push(`/pawns/${selected.id}`)
    } catch (e) {
      showToast({ tone: 'error', title: 'บันทึกไม่สำเร็จ', message: errorMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  const backTarget = selected ? `/pawns/${selected.id}` : '/pawns'

  return (
    <main className="page-container">
      <div style={{ padding: '56px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push(backTarget)} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 26, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 22, fontWeight: 800 }}>ตัดดอก</div>
      </div>

      {loadingPawns ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Loading...</div>
      ) : (
        <>
          {!pawnIdFromUrl && (
            <>
              <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600 }}>เลือกตั๋วจำนำ</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {pawns.map((pawn) => (
                  <div
                    key={pawn.id}
                    onClick={() => setSelected(pawn)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '14px 16px',
                      borderRadius: 16,
                      cursor: 'pointer',
                      border: `1px solid ${selected?.id === pawn.id ? 'var(--gold)' : 'var(--border)'}`,
                      background: selected?.id === pawn.id ? 'rgba(242,201,76,0.1)' : 'var(--black-800)',
                    }}
                  >
                    <span style={{ fontSize: 22 }}>🥚</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>ตั๋ว #{pawn.ticket_no}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{toThaiDateShort(pawn.pawn_date)}</div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)' }}>฿{fmt(pawn.amount)}</div>
                    {selected?.id === pawn.id && <span style={{ fontSize: 18, color: 'var(--gold)' }}>✓</span>}
                  </div>
                ))}
              </div>
            </>
          )}

          {pawnIdFromUrl && selected && (
            <div style={{ background: 'rgba(242,201,76,0.08)', border: '1px solid rgba(242,201,76,0.24)', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <span style={{ fontSize: 22 }}>🥚</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>ตั๋ว #{selected.ticket_no}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{toThaiDateShort(selected.pawn_date)}</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)' }}>฿{fmt(selected.amount)}</div>
            </div>
          )}

          {selected && (
            <>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>จำนวนดอกเบี้ย (บาท)</div>
                <input className="input-field" type="number" placeholder="เช่น 600" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>วันที่ตัดดอก</div>
                <input className="input-field" type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>สลิปโอนเงิน</div>
                {preview ? (
                  <div style={{ position: 'relative' }}>
                    <img src={preview} style={{ width: '100%', borderRadius: 14, maxHeight: 200, objectFit: 'contain', background: 'var(--black-700)' }} alt="slip" />
                    <button onClick={() => { setPreview(''); setImage(null) }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: 99, width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>×</button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '18px 12px', cursor: 'pointer', background: 'var(--black-800)' }}>
                      <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFile(e.target.files?.[0])} style={{ display: 'none' }} />
                      <span style={{ fontSize: 30 }}>📷</span>
                      <span style={{ color: 'var(--gold)', fontWeight: 600, fontSize: 15 }}>ถ่ายรูป</span>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '18px 12px', cursor: 'pointer', background: 'var(--black-800)' }}>
                      <input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} style={{ display: 'none' }} />
                      <span style={{ fontSize: 30 }}>🖼️</span>
                      <span style={{ color: 'var(--gold)', fontWeight: 600, fontSize: 15 }}>เลือกจากคลัง</span>
                    </label>
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>หมายเหตุ (ถ้ามี)</div>
                <input className="input-field" placeholder="เช่น ตัดดอกเดือนนี้" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
              <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: 18 }}>
                {saving ? 'กำลังบันทึก...' : 'บันทึกการตัดดอก'}
              </button>
            </>
          )}
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
