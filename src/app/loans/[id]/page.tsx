'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useToast } from '@/components/ToastProvider'
import { createNotificationAction } from '@/lib/notification-meta'
import { pingPushDispatch } from '@/lib/push-client'
import { assertImageFile, uploadSlip } from '@/lib/slip-storage'
import { supabase } from '@/lib/supabase'
import { errorMessage, parsePositiveMoney, requireDate } from '@/lib/validation'

type TxnType = 'interest' | 'principal_payment' | 'close'

type LoanRow = {
  id: string
  borrower_name: string
  principal: number
  remaining_principal: number
  interest_rate: number
  notes: string | null
  status: 'active' | 'closed'
}

type LoanTxnRow = {
  id: string
  type: string
  amount: number
  transaction_date: string
  slip_url: string | null
  note: string | null
}

export default function LoanDetail() {
  const router = useRouter()
  const { id } = useParams()
  const { showToast } = useToast()
  const [loan, setLoan] = useState<LoanRow | null>(null)
  const [txns, setTxns] = useState<LoanTxnRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [txnType, setTxnType] = useState<TxnType>('interest')
  const [saving, setSaving] = useState(false)
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [viewImg, setViewImg] = useState('')
  const [form, setForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], note: '' })

  useEffect(() => {
    if (id) void loadData()
  }, [id])

  async function loadData() {
    const { data: loanData } = await supabase
      .from('loans')
      .select('id, borrower_name, principal, remaining_principal, interest_rate, notes, status')
      .eq('id', id)
      .maybeSingle()
    if (loanData) setLoan(loanData as LoanRow)

    const { data: txnData } = await supabase
      .from('loan_transactions')
      .select('id, type, amount, transaction_date, slip_url, note')
      .eq('loan_id', id)
      .order('transaction_date')
    setTxns((txnData as LoanTxnRow[] | null) || [])
    setLoading(false)
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
    if (!loan) return
    if (!form.amount && txnType !== 'close') {
      showToast({ tone: 'error', title: 'ข้อมูลยังไม่ครบ', message: 'กรุณากรอกจำนวนเงิน' })
      return
    }

    setSaving(true)
    try {
      let slipUrl = ''
      if (image) {
        slipUrl = await uploadSlip(image, 'loans')
      }

      const amount = txnType === 'close' ? loan.remaining_principal : parsePositiveMoney(form.amount, 'Transaction amount')
      const transactionDate = requireDate(form.date, 'Transaction date')

      await supabase.from('loan_transactions').insert({
        loan_id: id,
        type: txnType,
        amount,
        transaction_date: transactionDate,
        slip_url: slipUrl,
        note: form.note,
      })

      if (txnType === 'principal_payment') {
        const newRemaining = Math.max(0, loan.remaining_principal - amount)
        await supabase.from('loans').update({ remaining_principal: newRemaining }).eq('id', id)
      } else if (txnType === 'close') {
        await supabase.from('loans').update({ remaining_principal: 0, status: 'closed' }).eq('id', id)
      }

      const notificationType =
        txnType === 'interest'
          ? 'loan_interest_paid'
          : txnType === 'principal_payment'
            ? 'loan_principal_paid'
            : 'loan_closed'

      const notificationMessage =
        txnType === 'interest'
          ? `รับดอกสินเชื่อ ${loan.borrower_name} ฿${amount.toLocaleString('th-TH')}`
          : txnType === 'principal_payment'
            ? `ตัดต้นสินเชื่อ ${loan.borrower_name} ฿${amount.toLocaleString('th-TH')}`
            : `ปิดสินเชื่อ ${loan.borrower_name} เรียบร้อย`

      await supabase.from('notifications').insert({
        type: notificationType,
        message: notificationMessage,
        action_url: createNotificationAction(`/loans/${id}`, ['owner']),
      })
      await pingPushDispatch()

      const typeLabel = txnType === 'interest' ? 'ตัดดอก' : txnType === 'principal_payment' ? 'ตัดต้น' : 'ปิดหนี้'
      showToast({ tone: 'success', title: 'บันทึกสำเร็จ', message: `${typeLabel}เรียบร้อยแล้ว` })
      setShowForm(false)
      setForm({ amount: '', date: new Date().toISOString().split('T')[0], note: '' })
      setImage(null)
      setPreview('')
      await loadData()
    } catch (e) {
      showToast({ tone: 'error', title: 'บันทึกไม่สำเร็จ', message: errorMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  async function uploadTxnSlip(txnId: string, file: File) {
    setSaving(true)
    try {
      assertImageFile(file)
      const slipUrl = await uploadSlip(file, 'loans')
      await supabase.from('loan_transactions').update({ slip_url: slipUrl }).eq('id', txnId)
      await loadData()
      showToast({ tone: 'success', title: 'อัปสลิปแล้ว', message: 'เพิ่มหลักฐานย้อนหลังเรียบร้อย' })
    } catch (error) {
      showToast({ tone: 'error', title: 'อัปสลิปไม่สำเร็จ', message: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--gold)', fontSize: 18 }}>กำลังโหลด...</div>
  if (!loan) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>ไม่พบข้อมูล</div>

  const totalInterest = txns.filter((txn) => txn.type === 'interest').reduce((sum, txn) => sum + txn.amount, 0)
  const totalPaid = txns.filter((txn) => txn.type === 'principal_payment' || txn.type === 'close').reduce((sum, txn) => sum + txn.amount, 0)
  const fmtMoney = (n: number) => n.toLocaleString('th-TH')

  const txnTypeLabel: Record<string, string> = { principal: 'ปล่อยกู้', interest: 'ตัดดอก', principal_payment: 'ตัดต้น', close: 'ปิดหนี้' }
  const txnTypeColor: Record<string, string> = { principal: 'var(--gold)', interest: 'var(--gold-light)', principal_payment: 'var(--gold-soft)', close: 'var(--danger-soft)' }

  return (
    <main className="page-container">
      {viewImg && (
        <div onClick={() => setViewImg('')} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <img src={viewImg} alt="slip" style={{ maxWidth: '100%', maxHeight: '90dvh', borderRadius: 12, objectFit: 'contain' }} />
          <button onClick={() => setViewImg('')} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 99, width: 40, height: 40, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
      )}

      <div style={{ padding: '56px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/loans')} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 26, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{loan.borrower_name}</div>
        <span className={loan.status === 'active' ? 'badge-active' : 'badge-closed'} style={{ marginLeft: 'auto' }}>
          {loan.status === 'active' ? 'ค้างอยู่' : 'ปิดแล้ว'}
        </span>
      </div>

      <div className="panel-gold" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>เงินต้นเริ่มต้น</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>฿{fmtMoney(loan.principal)}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>ยอดค้างชำระ</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold)' }}>฿{fmtMoney(loan.remaining_principal)}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>ดอกรวมได้รับ</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold-light)' }}>฿{fmtMoney(totalInterest)}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>ต้นที่รับคืนแล้ว</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold-soft)' }}>฿{fmtMoney(totalPaid)}</div>
          </div>
        </div>
        {loan.interest_rate > 0 && (
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>ดอกเบี้ย {loan.interest_rate}%/เดือน · คิดเป็น ฿{fmtMoney(Math.round(loan.remaining_principal * loan.interest_rate / 100))}/เดือน</div>
        )}
        {loan.notes && <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>{loan.notes}</div>}
      </div>

      {loan.status === 'active' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          {(['interest', 'principal_payment', 'close'] as TxnType[]).map((type) => (
            <button
              key={type}
              onClick={() => { setTxnType(type); setShowForm(true) }}
              style={{ padding: '12px 8px', borderRadius: 14, border: '1px solid var(--border-hover)', background: showForm && txnType === type ? 'rgba(242,201,76,0.15)' : 'transparent', color: txnTypeColor[type], fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'center' }}
            >
              {type === 'interest' ? 'ตัดดอก' : type === 'principal_payment' ? 'ตัดต้น' : 'ปิดหนี้'}
            </button>
          ))}
        </div>
      )}

      {showForm && loan.status === 'active' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: txnTypeColor[txnType] }}>
            {txnType === 'interest' ? 'ตัดดอกเบี้ย' : txnType === 'principal_payment' ? 'ตัดเงินต้น' : 'ปิดหนี้ทั้งหมด'}
          </div>
          {txnType === 'close' ? (
            <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 16 }}>
              ยืนยันปิดหนี้ยอดค้าง ฿{fmtMoney(loan.remaining_principal)}
            </div>
          ) : (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>จำนวนเงิน (บาท)</div>
              <input className="input-field" type="number" placeholder={txnType === 'interest' ? `เช่น ${Math.round(loan.remaining_principal * (loan.interest_rate || 3) / 100)}` : `ยอดค้าง ฿${fmtMoney(loan.remaining_principal)}`} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>วันที่</div>
            <input className="input-field" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>หมายเหตุ</div>
            <input className="input-field" placeholder="(ถ้ามี)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>สลิปโอนเงิน</div>
            {preview ? (
              <div style={{ position: 'relative' }}>
                <img src={preview} onClick={() => setViewImg(preview)} style={{ width: '100%', borderRadius: 12, maxHeight: 160, objectFit: 'contain', background: 'var(--black-700)', cursor: 'pointer' }} alt="slip" />
                <button onClick={() => { setPreview(''); setImage(null) }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: 99, width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '14px', cursor: 'pointer', background: 'var(--black-700)' }}>
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFile(e.target.files?.[0])} style={{ display: 'none' }} />
                  <span style={{ fontSize: 26 }}>📷</span>
                  <span style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>ถ่ายรูป</span>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--border-hover)', borderRadius: 14, padding: '14px', cursor: 'pointer', background: 'var(--black-700)' }}>
                  <input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} style={{ display: 'none' }} />
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

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>ประวัติทั้งหมด</div>
        {txns.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 15, textAlign: 'center' }}>ยังไม่มีรายการ</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {txns.map((txn, index) => (
              <div key={txn.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: index < txns.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                {txn.slip_url ? (
                  <img src={txn.slip_url} onClick={() => setViewImg(txn.slip_url || '')} style={{ width: 50, height: 50, borderRadius: 8, objectFit: 'cover', cursor: 'pointer', flexShrink: 0, background: 'var(--black-700)' }} alt="slip" />
                ) : (
                  <div style={{ width: 50, height: 50, borderRadius: 8, background: 'var(--black-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {txn.type === 'principal' ? '💵' : txn.type === 'interest' ? '✂️' : txn.type === 'principal_payment' ? '💰' : '✅'}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{txnTypeLabel[txn.type] || txn.type}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(txn.transaction_date).toLocaleDateString('th-TH')}</div>
                  {txn.note && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{txn.note}</div>}
                  {!txn.slip_url && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, border: '1.5px dashed var(--border-hover)', borderRadius: 10, padding: '10px', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                        <input type="file" accept="image/*" capture="environment" disabled={saving} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadTxnSlip(txn.id, file) }} style={{ display: 'none' }} />
                        <span style={{ fontSize: 18 }}>📷</span>
                        <span style={{ color: 'var(--gold)', fontSize: 11, fontWeight: 600 }}>อัปสลิป</span>
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, border: '1.5px dashed var(--border-hover)', borderRadius: 10, padding: '10px', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                        <input type="file" accept="image/*" disabled={saving} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadTxnSlip(txn.id, file) }} style={{ display: 'none' }} />
                        <span style={{ fontSize: 18 }}>🖼️</span>
                        <span style={{ color: 'var(--gold)', fontSize: 11, fontWeight: 600 }}>จากคลัง</span>
                      </label>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: txnTypeColor[txn.type] || 'var(--gold)', flexShrink: 0 }}>
                  {txn.type === 'principal' ? '-' : '+'}฿{fmtMoney(txn.amount)}
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
