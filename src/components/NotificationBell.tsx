'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  enablePushNotifications,
  isIosDevice,
  isStandaloneMode,
  resolvePushState,
  type PushState,
} from '@/lib/push-client'

interface Props {
  pendingPawns: any[]
  pendingRedeems: any[]
}

export default function NotificationBell({ pendingPawns, pendingRedeems }: Props) {
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pushState, setPushState] = useState<PushState>('default')
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMessage, setPushMessage] = useState('')
  const [iosInstallNeeded, setIosInstallNeeded] = useState(false)

  const total = pendingPawns.length + pendingRedeems.length
  const needsPushPrompt = pushState !== 'enabled'

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    void resolvePushState().then(setPushState)
    setIosInstallNeeded(isIosDevice() && !isStandaloneMode())
  }, [])

  async function handleEnablePush() {
    setPushBusy(true)
    setPushMessage('')

    try {
      await enablePushNotifications()
      setPushState('enabled')
      setPushMessage('เปิดแจ้งเตือนบนเครื่องนี้แล้ว')
    } catch (error) {
      setPushState(await resolvePushState())
      setPushMessage(error instanceof Error ? error.message : 'เปิดแจ้งเตือนไม่สำเร็จ')
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="การแจ้งเตือน"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 24, color: needsPushPrompt ? 'var(--gold-light)' : 'var(--text-primary)' }}>🔔</span>

        {total > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -1,
              right: -1,
              background: 'linear-gradient(135deg,#C9922A,#F2C94C)',
              color: '#080808',
              fontSize: 11,
              fontWeight: 800,
              borderRadius: 99,
              minWidth: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            {total}
          </span>
        )}

        {needsPushPrompt && (
          <span
            style={{
              position: 'absolute',
              bottom: 4,
              right: 5,
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: '#D1554F',
              border: '2px solid var(--black-900)',
            }}
          />
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 46,
            right: 0,
            background: 'var(--black-800)',
            border: '1px solid var(--border)',
            borderRadius: 18,
            padding: 8,
            minWidth: 300,
            zIndex: 100,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 12px 8px', fontWeight: 700, letterSpacing: 0.5 }}>
            การแจ้งเตือน
          </div>

          {needsPushPrompt && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 14,
                background: 'rgba(242,201,76,0.06)',
                border: '1px solid rgba(242,201,76,0.14)',
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold-light)' }}>เปิดแจ้งเตือนบนเครื่องนี้</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.45 }}>
                    เด้งได้แม้ไม่ได้เปิดแอป เหมือนแอปมือถือที่ปักหน้าจอไว้
                  </div>
                </div>
                <span className="badge-pending">ยังไม่เปิด</span>
              </div>

              {iosInstallNeeded && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 8 }}>
                  บน iPhone ให้เพิ่มแอปไว้ที่หน้าจอก่อน แล้วค่อยเปิดจากไอคอนนั้นเพื่ออนุญาตแจ้งเตือน
                </div>
              )}

              {pushState === 'blocked' && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 8 }}>
                  เครื่องนี้เคยบล็อกแจ้งเตือนไว้ ต้องกลับไปเปิดที่การตั้งค่าของเบราว์เซอร์หรือแอปก่อน
                </div>
              )}

              {pushState === 'unsupported' && !iosInstallNeeded && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 8 }}>
                  เครื่องนี้ยังไม่รองรับการแจ้งเตือนแบบแอป หรือยังไม่ได้เปิดจากเบราว์เซอร์ที่รองรับ
                </div>
              )}

              <button
                type="button"
                className="btn-primary"
                onClick={() => void handleEnablePush()}
                disabled={pushBusy || pushState === 'unsupported'}
                style={{ fontSize: 14, padding: '12px 14px', minHeight: 46 }}
              >
                {pushBusy ? 'กำลังเปิด...' : 'เปิดแจ้งเตือน'}
              </button>

              {pushMessage && (
                <div style={{ fontSize: 12, color: 'var(--gold-light)', marginTop: 8, lineHeight: 1.45 }}>
                  {pushMessage}
                </div>
              )}
            </div>
          )}

          {pendingPawns.map((pawn) => (
            <div
              key={pawn.id}
              onClick={() => {
                router.push(`/pawns/${pawn.id}`)
                setOpen(false)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                cursor: 'pointer',
                background: 'rgba(242,201,76,0.08)',
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 22, flexShrink: 0 }}>🪿</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>มีรายการรับจำนำใหม่</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ตั๋ว #{pawn.ticket_no} · ฿{pawn.amount?.toLocaleString('th-TH')} · โอนตังเลย
                </div>
              </div>
              <span style={{ fontSize: 16, color: 'var(--gold)', flexShrink: 0 }}>›</span>
            </div>
          ))}

          {pendingRedeems.map((redeem) => (
            <div
              key={redeem.id}
              onClick={() => {
                router.push(`/redeem/confirm/${redeem.id}`)
                setOpen(false)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                cursor: 'pointer',
                background: 'rgba(242,201,76,0.06)',
                marginBottom: 6,
                border: '1px solid rgba(242,201,76,0.16)',
              }}
            >
              <span style={{ fontSize: 22, flexShrink: 0 }}>🐣</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold-light)' }}>มีรายการไถ่ถอน</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ตั๋ว #{redeem.pawns?.ticket_no} · รอยืนยัน
                </div>
              </div>
              <span style={{ fontSize: 16, color: 'var(--gold-light)', flexShrink: 0 }}>›</span>
            </div>
          ))}

          {total === 0 && (
            <div style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>
              ตอนนี้ยังไม่มีรายการค้างใหม่ เดี๋ยวถ้ามีงานเข้า กระดิ่งนี้จะรวมไว้ให้ทั้งการแจ้งเตือนและรายการที่ต้องทำต่อ
            </div>
          )}
        </div>
      )}
    </div>
  )
}
