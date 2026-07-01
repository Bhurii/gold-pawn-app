'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useToast } from '@/components/ToastProvider'
import { getSession } from '@/lib/auth'
import { type FundOwnerKey } from '@/lib/fund-owner'
import { pingPushDispatch } from '@/lib/push-client'
import { fmt, toThaiDateLong } from '@/lib/utils'
import { errorMessage } from '@/lib/validation'

type RedemptionRow = {
  id: string
  pawn_id: string
  redeem_date: string
  interest_total: number
  pawn_slip_url: string | null
  transfer_slip_url: string | null
}

type PawnRow = {
  id: string
  ticket_no: string
  amount: number
  fund_owner?: FundOwnerKey
}

export default function ConfirmRedeem() {
  const router = useRouter()
  const { id } = useParams()
  const { showToast } = useToast()
  const user = getSession()
  const [redemption, setRedemption] = useState<RedemptionRow | null>(null)
  const [pawn, setPawn] = useState<PawnRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [viewImg, setViewImg] = useState('')

  useEffect(() => {
    if (user?.role === 'viewer') {
      router.replace('/')
      return
    }
    void loadData()
  }, [])

  async function loadData() {
    try {
      const response = await fetch(`/api/redemptions/${encodeURIComponent(String(id))}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'โหลดข้อมูลตั๋วไม่สำเร็จ')
      }
      setPawn((payload?.pawn as PawnRow | null) || null)
      setRedemption((payload?.redemption as RedemptionRow | null) || null)
    } catch {
      setPawn(null)
      setRedemption(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!redemption || !pawn) return
    setConfirming(true)
    try {
      const response = await fetch('/api/pawn-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm_redeem',
          redemption_id: redemption.id,
          pawn_id: redemption.pawn_id,
          ticket_no: pawn.ticket_no,
          fund_owner: pawn.fund_owner || 'tony',
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'ยืนยันไถ่ถอนไม่สำเร็จ')
      }

      await pingPushDispatch()
      showToast({ tone: 'success', title: 'ยืนยันสำเร็จ', message: 'ไถ่ถอนเรียบร้อยแล้ว' })
      router.replace('/')
    } catch (e) {
      showToast({ tone: 'error', title: 'ยืนยันไม่สำเร็จ', message: errorMessage(e) })
    } finally {
      setConfirming(false)
    }
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--gold)', fontSize: 18 }}>กำลังโหลด...</div>
  if (!redemption || !pawn) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>ไม่พบข้อมูลรายการไถ่ถอน</div>

  const backTarget = `/pawns/${pawn.id}`

  return (
    <main className="page-container">
      {viewImg && (
        <div onClick={() => setViewImg('')} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.97)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <img src={viewImg} style={{ maxWidth: '100%', maxHeight: '90dvh', borderRadius: 12, objectFit: 'contain' }} alt="preview" />
          <button onClick={() => setViewImg('')} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 99, width: 44, height: 44, fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
      )}

      <div style={{ padding: '56px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push(backTarget)} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 26, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 22, fontWeight: 800 }}>ยืนยันไถ่ถอน</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'var(--gold)' }} />
        <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'var(--gold)' }} />
        <div style={{ fontSize: 12, color: 'var(--gold)', marginLeft: 4 }}>Step 2/2</div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>ตรวจสอบข้อมูลแล้วกดยืนยัน</div>

      <div className="panel-gold" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>ตั๋ว #{pawn.ticket_no}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)', marginBottom: 4 }}>฿{fmt(pawn.amount)}</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>วันที่คืน: {toThaiDateLong(redemption.redeem_date)}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>
          <span>ดอกรวมทั้งหมด</span>
          <span style={{ color: 'var(--gold-light)', fontWeight: 700 }}>+฿{fmt(redemption.interest_total)}</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>หลักฐานจากเจ้หลุย</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {redemption.pawn_slip_url ? (
            <div onClick={() => setViewImg(redemption.pawn_slip_url || '')} style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>ตั๋วจำนำ</div>
              <div style={{ position: 'relative' }}>
                <img src={redemption.pawn_slip_url} style={{ width: '100%', height: 100, borderRadius: 10, objectFit: 'cover', background: 'var(--black-700)' }} alt="pawn" />
                <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔍</div>
              </div>
            </div>
          ) : <div style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center' }}>ไม่มีรูปตั๋ว</div>}
          {redemption.transfer_slip_url ? (
            <div onClick={() => setViewImg(redemption.transfer_slip_url || '')} style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>สลิปโอนเงิน</div>
              <div style={{ position: 'relative' }}>
                <img src={redemption.transfer_slip_url} style={{ width: '100%', height: 100, borderRadius: 10, objectFit: 'cover', background: 'var(--black-700)' }} alt="transfer" />
                <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔍</div>
              </div>
            </div>
          ) : <div style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center' }}>ไม่มีสลิป</div>}
        </div>
      </div>

      <button className="btn-primary" onClick={handleConfirm} disabled={confirming} style={{ fontSize: 18, marginBottom: 12 }}>
        {confirming ? 'กำลังยืนยัน...' : 'ยืนยันไถ่ถอนแล้ว'}
      </button>
      <button onClick={() => router.push(backTarget)} className="btn-secondary" style={{ fontSize: 16 }}>
        ยังไม่ยืนยัน
      </button>
      <div style={{ height: 32 }} />
    </main>
  )
}
