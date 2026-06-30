'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ActionAuditPanel from '@/components/ActionAuditPanel'
import { useToast } from '@/components/ToastProvider'
import { getSession } from '@/lib/auth'
import { getReadableUserName } from '@/lib/fund-owner'
import { pingPushDispatch } from '@/lib/push-client'
import { assertImageFile, uploadSlip } from '@/lib/slip-storage'
import type { LoanDetailData, LoanRow, LoanTxnRow } from '@/lib/server/loan-detail'
import { errorMessage, parsePositiveMoney, requireDate } from '@/lib/validation'

type TxnType = 'interest' | 'principal_payment' | 'close'

type Props = {
  loanId: string
  initialData: LoanDetailData
}

const EMPTY_FORM = { amount: '', date: new Date().toISOString().split('T')[0], note: '' }

export default function LoanDetailClient({ loanId, initialData }: Props) {
  const router = useRouter()
  const { showToast } = useToast()
  const user = getSession()
  const [loan, setLoan] = useState<LoanRow | null>(initialData.loan)
  const [txns, setTxns] = useState<LoanTxnRow[]>(initialData.txns)
  const [audits, setAudits] = useState(initialData.audits)
  const [showForm, setShowForm] = useState(false)
  const [txnType, setTxnType] = useState<TxnType>('interest')
  const [saving, setSaving] = useState(false)
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [viewImg, setViewImg] = useState('')
  const [expandedTxnUploadId, setExpandedTxnUploadId] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingTxn, setEditingTxn] = useState<LoanTxnRow | null>(null)
  const [deletingTxn, setDeletingTxn] = useState<LoanTxnRow | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [actionRemark, setActionRemark] = useState('')
  const [actionSaving, setActionSaving] = useState(false)

  useEffect(() => {
    saveCache(initialData)
    hydrateFromCache()
    void loadData()
  }, [loanId])

  function getCacheKey() {
    return `loan-detail:${loanId}`
  }

  function hydrateFromCache() {
    if (typeof window === 'undefined') return

    try {
      const raw = window.sessionStorage.getItem(getCacheKey())
      if (!raw) return
      const cached = JSON.parse(raw) as LoanDetailData
      setLoan(cached.loan || null)
      setTxns(cached.txns || [])
      setAudits(cached.audits || [])
    } catch {
      // Ignore invalid cache.
    }
  }

  function saveCache(nextCache: LoanDetailData) {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(getCacheKey(), JSON.stringify(nextCache))
  }

  async function loadData() {
    try {
      const response = await fetch(`/api/loans/${loanId}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'โหลดข้อมูลสินเชื่อไม่สำเร็จ')
      }

      const nextData: LoanDetailData = {
        loan: (payload?.loan as LoanRow | null) || null,
        txns: (payload?.txns as LoanTxnRow[] | null) || [],
        audits: (payload?.audits as LoanDetailData['audits'] | null) || [],
      }

      setLoan(nextData.loan)
      setTxns(nextData.txns)
      setAudits(nextData.audits)
      saveCache(nextData)
    } catch {
      // Keep current data on background refresh failure.
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

  function closeActionDialog() {
    setEditingTxn(null)
    setDeletingTxn(null)
    setEditForm(EMPTY_FORM)
    setActionRemark('')
  }

  function openEditTxn(txn: LoanTxnRow) {
    setDeletingTxn(null)
    setEditingTxn(txn)
    setEditForm({
      amount: String(txn.amount || ''),
      date: txn.transaction_date || '',
      note: txn.note || '',
    })
    setActionRemark('')
  }

  function openDeleteTxn(txn: LoanTxnRow) {
    setEditingTxn(null)
    setDeletingTxn(txn)
    setActionRemark('')
  }

  async function submitTxnEdit() {
    if (!editingTxn) return

    setActionSaving(true)
    try {
      const changes: Record<string, unknown> = {
        transaction_date: editForm.date,
        note: editForm.note,
      }
      if (editingTxn.type !== 'close') {
        const amount = Number(editForm.amount || 0)
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error('จำนวนเงินต้องมากกว่า 0')
        }
        changes.amount = amount
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(editForm.date)) {
        throw new Error('กรุณาเลือกวันที่ให้ถูกต้อง')
      }

      const response = await fetch('/api/action-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'update',
          entity_type: 'loan_transaction',
          record_id: editingTxn.id,
          parent_type: 'loan',
          parent_id: loanId,
          remark: actionRemark,
          changes,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'แก้ไขรายการไม่สำเร็จ')
      }

      await loadData()
      closeActionDialog()
      showToast({ tone: 'success', title: 'แก้ไขแล้ว', message: 'บันทึกการแก้ไขรายการสินเชื่อเรียบร้อย' })
    } catch (error) {
      showToast({ tone: 'error', title: 'บันทึกไม่สำเร็จ', message: errorMessage(error) })
    } finally {
      setActionSaving(false)
    }
  }

  async function submitTxnDelete() {
    if (!deletingTxn) return

    setActionSaving(true)
    try {
      const response = await fetch('/api/action-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'delete',
          entity_type: 'loan_transaction',
          record_id: deletingTxn.id,
          parent_type: 'loan',
          parent_id: loanId,
          remark: actionRemark,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'ลบรายการไม่สำเร็จ')
      }

      await loadData()
      closeActionDialog()
      showToast({ tone: 'success', title: 'ลบแล้ว', message: 'ลบรายการสินเชื่อเรียบร้อย' })
    } catch (error) {
      showToast({ tone: 'error', title: 'ลบไม่สำเร็จ', message: errorMessage(error) })
    } finally {
      setActionSaving(false)
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

      const response = await fetch('/api/loan-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loan_id: loanId,
          type: txnType,
          amount,
          transaction_date: transactionDate,
          slip_url: slipUrl,
          note: form.note,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'บันทึกรายการสินเชื่อไม่สำเร็จ')
      }
      void pingPushDispatch()

      const typeLabel = txnType === 'interest' ? 'ตัดดอก' : txnType === 'principal_payment' ? 'ตัดต้น' : 'ปิดหนี้'
      showToast({ tone: 'success', title: 'บันทึกสำเร็จ', message: `${typeLabel}เรียบร้อยแล้ว` })
      setShowForm(false)
      setForm(EMPTY_FORM)
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
      const response = await fetch('/api/loan-transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: txnId, slip_url: slipUrl }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'บันทึกสลิปย้อนหลังไม่สำเร็จ')
      }
      await loadData()
      showToast({ tone: 'success', title: 'อัปสลิปแล้ว', message: 'เพิ่มหลักฐานย้อนหลังเรียบร้อย' })
    } catch (error) {
      showToast({ tone: 'error', title: 'อัปสลิปไม่สำเร็จ', message: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  if (!loan) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>ไม่พบข้อมูล</div>

  const totalInterest = txns.filter((txn) => txn.type === 'interest').reduce((sum, txn) => sum + txn.amount, 0)
  const totalPaid = txns.filter((txn) => txn.type === 'principal_payment' || txn.type === 'close').reduce((sum, txn) => sum + txn.amount, 0)
  const fmtMoney = (n: number) => n.toLocaleString('th-TH')

  const txnTypeLabel: Record<string, string> = { principal: 'ปล่อยกู้', interest: 'ตัดดอก', principal_payment: 'ตัดต้น', close: 'ปิดหนี้' }
  const txnTypeColor: Record<string, string> = { principal: 'var(--gold)', interest: 'var(--gold-light)', principal_payment: 'var(--gold-soft)', close: 'var(--danger-soft)' }

  return (
    <main className="page-container">
      {viewImg ? (
        <div onClick={() => setViewImg('')} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <img src={viewImg} alt="slip" style={{ maxWidth: '100%', maxHeight: '90dvh', borderRadius: 12, objectFit: 'contain' }} />
          <button onClick={() => setViewImg('')} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 99, width: 40, height: 40, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
      ) : null}

      {editingTxn || deletingTxn ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 420, borderRadius: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
              {editingTxn ? 'แก้ไขรายการสินเชื่อ' : 'ลบรายการสินเชื่อ'}
            </div>

            {editingTxn ? (
              <>
                {editingTxn.type !== 'close' ? (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>จำนวนเงิน</div>
                    <input className="input-field" type="number" value={editForm.amount} onChange={(event) => setEditForm((current) => ({ ...current, amount: event.target.value }))} />
                  </div>
                ) : null}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>วันที่ทำรายการ</div>
                  <input className="input-field" type="date" value={editForm.date} onChange={(event) => setEditForm((current) => ({ ...current, date: event.target.value }))} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>หมายเหตุ</div>
                  <input className="input-field" value={editForm.note} onChange={(event) => setEditForm((current) => ({ ...current, note: event.target.value }))} placeholder="ถ้ามี" />
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12 }}>
                กำลังลบรายการ {txnTypeLabel[deletingTxn?.type || 'interest'] || '-'} ฿{fmtMoney(deletingTxn?.amount || 0)}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>เหตุผล / remark</div>
              <input className="input-field" value={actionRemark} onChange={(event) => setActionRemark(event.target.value)} placeholder={`เช่น ${editingTxn ? 'แก้ยอดผิด' : 'รายการซ้ำ'} โดย ${getReadableUserName(user)}`} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button type="button" className="btn-secondary" onClick={closeActionDialog} disabled={actionSaving}>ยกเลิก</button>
              <button
                type="button"
                className="btn-primary"
                onClick={editingTxn ? submitTxnEdit : submitTxnDelete}
                disabled={actionSaving}
                style={deletingTxn ? { background: 'linear-gradient(180deg, #7B2D2D 0%, #5B1717 100%)', color: '#FFE3E3' } : undefined}
              >
                {actionSaving ? 'กำลังบันทึก...' : editingTxn ? 'บันทึกการแก้ไข' : 'ยืนยันการลบ'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
        {loan.interest_rate > 0 ? (
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>ดอกเบี้ย {loan.interest_rate}%/เดือน · คิดเป็น ฿{fmtMoney(Math.round(loan.remaining_principal * loan.interest_rate / 100))}/เดือน</div>
        ) : null}
        {loan.notes ? <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>{loan.notes}</div> : null}
      </div>

      {loan.status === 'active' ? (
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
      ) : null}

      {showForm && loan.status === 'active' ? (
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
      ) : null}

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
                  {txn.note ? <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{txn.note}</div> : null}
                  {txn.type !== 'principal' ? (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => openEditTxn(txn)}
                        style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-hover)', background: 'rgba(242,201,76,0.08)', color: 'var(--gold-light)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteTxn(txn)}
                        style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(210,89,89,0.35)', background: 'rgba(210,89,89,0.08)', color: '#FFB4B4', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        ลบ
                      </button>
                      {!txn.slip_url ? (
                        <button
                          type="button"
                          onClick={() => setExpandedTxnUploadId(expandedTxnUploadId === txn.id ? '' : txn.id)}
                          style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-hover)', background: 'rgba(255,255,255,0.03)', color: 'var(--gold)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          เพิ่มสลิปย้อนหลัง
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {!txn.slip_url && expandedTxnUploadId === txn.id ? (
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
                  ) : null}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: txnTypeColor[txn.type] || 'var(--gold)', flexShrink: 0 }}>
                  {txn.type === 'principal' ? '-' : '+'}฿{fmtMoney(txn.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ActionAuditPanel audits={audits} />

      <div style={{ height: 32 }} />
    </main>
  )
}
