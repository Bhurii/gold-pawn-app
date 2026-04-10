'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type TxnType = 'interest' | 'principal_payment' | 'close'

export default function LoanDetail() {
  const router = useRouter()
  const { id } = useParams()
  const [loan, setLoan] = useState<any>(null)
  const [txns, setTxns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [txnType, setTxnType] = useState<TxnType>('interest')
  const [saving, setSaving] = useState(false)
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [viewImg, setViewImg] = useState('')
  const [form, setForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], note: '' })

  useEffect(() => { if (id) loadData() }, [id])

  async function loadData() {
    const { data: l } = await supabase.from('loans').select('*').eq('id', id).single()
    if (l) setLoan(l)
    const { data: t } = await supabase.from('loan_transactions').select('*').eq('loan_id', id).order('transaction_date')
    if (t) setTxns(t)
    setLoading(false)
  }

  async function handleSave() {
    if (!form.amount && txnType !== 'close') { alert('กรุณากรอกจำนวนเงิน'); return }
    setSaving(true)
    try {
      let slip_url = ''
      if (image) {
        const path = `loans/${Date.now()}.${image.name.split('.').pop()}`
        const { error } = await supabase.storage.from('slips').upload(path, image)
        if (!error) { const { data } = supabase.storage.from('slips').getPublicUrl(path); slip_url = data.publicUrl }
      }

      const amount = txnType === 'close' ? loan.remaining_principal : parseFloat(form.amount)

      await supabase.from('loan_transactions').insert({
        loan_id: id, type: txnType, amount,
        transaction_date: form.date, slip_url, note: form.note
      })

      if (txnType === 'principal_payment') {
        const newRemaining = Math.max(0, loan.remaining_principal - amount)
        await supabase.from('loans').update({ remaining_principal: newRemaining }).eq('id', id)
      } else if (txnType === 'close') {
        await supabase.from('loans').update({ remaining_principal: 0, status: 'closed' }).eq('id', id)
      }

      const typeLabel = txnType === 'interest' ? 'ตัดดอก' : txnType === 'principal_payment' ? 'ตัดต้น' : 'ปิดหนี้'
      alert(`${typeLabel}สำเร็จ!`)
      setShowForm(false)
      setForm({ amount: '', date: new Date().toISOString().split('T')[0], note: '' })
      setImage(null); setPreview('')
      loadData()
    } catch (e: any) {
      alert('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--gold)', fontSize: 18 }}>กำลังโหลด...</div>
  if (!loan) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>ไม่พบข้อมูล</div>

  const totalInterest = txns.filter(t => t.type === 'interest').reduce((s, t) => s + t.amount, 0)
  const totalPaid = txns.filter(t => t.type === 'principal_payment' || t.type === 'close').reduce((s, t) => s + t.amount, 0)
  const fmt = (n: number) => n.toLocaleString('th-TH')

  const txnTypeLabel: Record<string, string> = { principal: '💵 ปล่อยกู้', interest: '✂️ ตัดดอก', principal_payment: '💰 ตัดต้น', close: '✅ ปิดหนี้' }
  const txnTypeColor: Record<string, string> = { principal: 'var(--gold)', interest: '#6fcf6f', principal_payment: '#85b7eb', close: '#f09595' }

  return (
    <main className="page-container">
      {viewImg && (
        <div onClick={() => setViewImg('')} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <img src={viewImg} alt="slip" style={{ maxWidth: '100%', maxHeight: '90dvh', borderRadius: 12, objectFit: 'contain' }} />
          <button onClick={() => setViewImg('')} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 99, width: 40, height: 40, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <div style={{ padding: '56px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 26, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{loan.borrower_name}</div>
        <span className={loan.status === 'active' ? 'badge-active' : 'badge-closed'} style={{ marginLeft: 'auto' }}>
          {loan.status === 'active' ? 'ค้างอยู่' : 'ปิดแล้ว'}
        </span>
      </div>

      {/* สรุปยอด */}
      <div style={{ background: 'linear-gradient(135deg,#180F00,#2C1A00)', border: '1px solid rgba(242,201,76,0.35)', borderRadius: 20, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>เงินต้นเริ่มต้น</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>฿{fmt(loan.principal)}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>ยอดค้างชำระ</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold)' }}>฿{fmt(loan.remaining_principal)}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>ดอกรวมได้รับ</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#6fcf6f' }}>฿{fmt(totalInterest)}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>ต้นที่รับคืนแล้ว</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#85b7eb' }}>฿{fmt(totalPaid)}</div>
          </div>
        </div>
        {loan.interest_rate > 0 && (
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>ดอกเบี้ย {loan.interest_rate}%/เดือน · คิดเป็น ฿{fmt(Math.round(loan.remaining_principal * loan.interest_rate / 100))}/เดือน</div>
        )}
        {loan.notes && <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>{loan.notes}</div>}
      </div>

      {/* ปุ่ม action */}
      {loan.status === 'active' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          {(['interest', 'principal_payment', 'close'] as TxnType[]).map(t => (
            <button key={t} onClick={() => { setTxnType(t); setShowForm(true) }}
              style={{ padding: '12px 8px', borderRadius: 14, border: '1px solid var(--border-hover)', background: showForm && txnType === t ? 'rgba(242,201,76,0.15)' : 'transparent', color: txnTypeColor[t], fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'center' }}>
              {t === 'interest' ? '✂️\nตัดดอก' : t === 'principal_payment' ? '💰\nตัดต้น' : '✅\nปิดหนี้'}
            </button>
          ))}
        </div>
      )}

      {/* ฟอร์ม */}
      {showForm && loan.status === 'active' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: txnTypeColor[txnType] }}>
            {txnType === 'interest' ? '✂️ ตัดดอกเบี้ย' : txnType === 'principal_payment' ? '💰 ตัดเงินต้น' : '✅ ปิดหนี้ทั้งหมด'}
          </div>
          {txnType === 'close' ? (
            <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 16 }}>
              ยืนยันปิดหนี้ยอดค้าง ฿{fmt(loan.remaining_principal)}
            </div>
          ) : (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>จำนวนเงิน (บาท)</div>
              <input className="input-field" type="number"
                placeholder={txnType === 'interest' ? `เช่น ${Math.round(loan.remaining_principal * (loan.interest_rate || 3) / 100)}` : `ยอดค้าง ฿${fmt(loan.remaining_principal)}`}
                value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>วันที่</div>
            <input className="input-field" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>หมายเหตุ</div>
            <input className="input-field" placeholder="(ถ้ามี)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>สลิปโอนเงิน</div>
            {preview ? (
              <div style={{ position: 'relative' }}>
                <img src={preview} onClick={() => setViewImg(preview)} style={{ width: '100%', borderRadius: 12, maxHeight: 160, objectFit: 'contain', background: 'var(--black-700)', cursor: 'pointer' }} alt="slip" />
                <button onClick={() => { setPreview(''); setImage(null) }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: 99, width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '14px', cursor: 'pointer', background: 'var(--black-700)' }}>
                  <input type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) { setImage(f); setPreview(URL.createObjectURL(f)) } }} style={{ display: 'none' }} />
                  <span style={{ fontSize: 26 }}>📷</span>
                  <span style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>ถ่ายรูป</span>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '14px', cursor: 'pointer', background: 'var(--black-700)' }}>
                  <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setImage(f); setPreview(URL.createObjectURL(f)) } }} style={{ display: 'none' }} />
                  <span style={{ fontSize: 26 }}>🖼️</span>
                  <span style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>เลือกจากคลัง</span>
                </label>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button className="btn-secondary" onClick={() => setShowForm(false)} style={{ fontSize: 16 }}>ยกเลิก</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: 16 }}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </div>
      )}

      {/* ประวัติ transaction */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>ประวัติทั้งหมด</div>
        {txns.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 15, textAlign: 'center' }}>ยังไม่มีรายการ</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {txns.map((t, i) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < txns.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                {t.slip_url ? (
                  <img src={t.slip_url} onClick={() => setViewImg(t.slip_url)} style={{ width: 50, height: 50, borderRadius: 8, objectFit: 'cover', cursor: 'pointer', flexShrink: 0, background: 'var(--black-700)' }} alt="slip" />
                ) : (
                  <div style={{ width: 50, height: 50, borderRadius: 8, background: 'var(--black-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {t.type === 'principal' ? '💵' : t.type === 'interest' ? '✂️' : t.type === 'principal_payment' ? '💰' : '✅'}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{txnTypeLabel[t.type] || t.type}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(t.transaction_date).toLocaleDateString('th-TH')}</div>
                  {t.note && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.note}</div>}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: txnTypeColor[t.type] || 'var(--gold)', flexShrink: 0 }}>
                  {t.type === 'principal' ? '-' : '+'}฿{fmt(t.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ height: 32 }} />
    </main>
  )
}
