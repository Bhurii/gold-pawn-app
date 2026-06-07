'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { errorMessage, parseNonNegativeMoney, parsePositiveMoney, requireDate } from '@/lib/validation'

export default function NewLoan() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    borrower_name: '',
    start_date: new Date().toISOString().split('T')[0],
    principal: '',
    interest_rate: '',
    notes: ''
  })

  async function handleSave() {
    if (!form.borrower_name || !form.principal) {
      alert('กรุณากรอกชื่อและจำนวนเงินให้ครบ')
      return
    }
    setSaving(true)
    try {
      const principal = parsePositiveMoney(form.principal, 'Loan principal')
      const interestRate = parseNonNegativeMoney(form.interest_rate, 'Interest rate')
      const startDate = requireDate(form.start_date, 'Start date')
      const { data: loan, error } = await supabase.from('loans').insert({
        borrower_name: form.borrower_name,
        start_date: startDate,
        principal,
        remaining_principal: principal,
        interest_rate: interestRate,
        notes: form.notes,
        status: 'active'
      }).select().single()
      if (error) throw error
      await supabase.from('loan_transactions').insert({
        loan_id: loan.id,
        type: 'principal',
        amount: principal,
        transaction_date: startDate,
        note: 'ปล่อยกู้ครั้งแรก'
      })
      alert('บันทึกสำเร็จ!')
      router.push(`/loans/${loan.id}`)
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page-container">
      <div style={{ padding: '56px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 26, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 22, fontWeight: 800 }}>ปลูกต้นไม้เพิ่ม</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>ชื่อลูกหนี้</div>
          <input className="input-field" placeholder="เช่น นาย ก. สมใจ" value={form.borrower_name} onChange={e => setForm({ ...form, borrower_name: e.target.value })} />
        </div>
        <div>
          <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>วันที่ปล่อยกู้</div>
          <input className="input-field" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
        </div>
        <div>
          <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>จำนวนเงินกู้ (บาท)</div>
          <input className="input-field" type="number" placeholder="เช่น 50000" value={form.principal} onChange={e => setForm({ ...form, principal: e.target.value })} />
        </div>
        <div>
          <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>อัตราดอกเบี้ย (%/เดือน)</div>
          <input className="input-field" type="number" placeholder="เช่น 3" value={form.interest_rate} onChange={e => setForm({ ...form, interest_rate: e.target.value })} />
        </div>
        <div>
          <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>หมายเหตุ</div>
          <input className="input-field" placeholder="เช่น กู้ซื้อรถ ค้ำประกันโดย..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: 18 }}>
          {saving ? 'กำลังบันทึก...' : '💵 บันทึกการปล่อยกู้'}
        </button>
      </div>
      <div style={{ height: 32 }} />
    </main>
  )
}
