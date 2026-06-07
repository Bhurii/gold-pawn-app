'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { errorMessage, parsePositiveMoney, requireDate } from '@/lib/validation'

export default function OtherIncome() {
  const router = useRouter()
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ income_date: new Date().toISOString().split('T')[0], amount: '', source: '', note: '' })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data } = await supabase.from('other_income').select('*').order('income_date', { ascending: false })
    if (data) setList(data)
    setLoading(false)
  }

  async function handleSave() {
    if (!form.amount || !form.source) { alert('กรุณากรอกข้อมูลให้ครบ'); return }
    setSaving(true)
    try {
      const amount = parsePositiveMoney(form.amount, 'Income amount')
      const incomeDate = requireDate(form.income_date, 'Income date')
      await supabase.from('other_income').insert({
        income_date: incomeDate,
        amount,
        source: form.source,
        note: form.note
      })
      setForm({ income_date: new Date().toISOString().split('T')[0], amount: '', source: '', note: '' })
      setShowForm(false)
      loadData()
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const total = list.reduce((s, i) => s + i.amount, 0)
  const fmt = (n: number) => n.toLocaleString('th-TH')

  return (
    <main className="page-container">
      <div style={{ padding: '56px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 26, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 22, fontWeight: 800 }}>รายได้อื่นๆ</div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ marginLeft: 'auto', background: 'linear-gradient(135deg,#C9922A,#F2C94C)', color: '#080808', border: 'none', borderRadius: 12, padding: '8px 18px', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)' }}>
          + เพิ่ม
        </button>
      </div>

      {/* ยอดรวม */}
      <div className="panel-gold" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>รายได้อื่นๆ รวม</div>
        <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--gold)' }}>฿{fmt(total)}</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>{list.length} รายการ</div>
      </div>

      {/* ฟอร์มเพิ่ม */}
      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>เพิ่มรายได้ใหม่</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>แหล่งรายได้</div>
              <input className="input-field" placeholder="เช่น ดอกเงินกู้นาย ก." value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} />
            </div>
            <div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>จำนวนเงิน (บาท)</div>
              <input className="input-field" type="number" placeholder="เช่น 500" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>วันที่</div>
              <input className="input-field" type="date" value={form.income_date} onChange={e => setForm({ ...form, income_date: e.target.value })} />
            </div>
            <div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>หมายเหตุ</div>
              <input className="input-field" placeholder="(ถ้ามี)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            </div>
            <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: 17 }}>
              {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
            </button>
          </div>
        </div>
      )}

      {/* รายการ */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--gold)', padding: 40, fontSize: 18 }}>กำลังโหลด...</div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40, fontSize: 16 }}>ยังไม่มีรายการ</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map(item => (
            <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(240,192,64,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>💵</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{item.source}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(item.income_date).toLocaleDateString('th-TH')}</div>
                {item.note && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{item.note}</div>}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold-light)', flexShrink: 0 }}>+฿{fmt(item.amount)}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 32 }} />
    </main>
  )
}
