'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchSession, hasOwnerPin, loginAgent, loginOwnerWithPassword, loginOwnerWithPin, loginPhat } from '@/lib/auth'

export default function Login() {
  const router = useRouter()
  const [mode, setMode] = useState<'owner' | 'agent' | 'viewer'>('agent')
  const [ownerHasPin, setOwnerHasPin] = useState<boolean | null>(null)
  const [pin, setPin] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void fetchSession().then((user) => {
      if (user) router.replace('/')
    })
    void loadOwnerMode()
  }, [router])

  async function loadOwnerMode() {
    const exists = await hasOwnerPin()
    setOwnerHasPin(exists)
  }

  function resetForm(nextMode: 'owner' | 'agent' | 'viewer') {
    setMode(nextMode)
    setError('')
    setPin('')
    setEmail('')
    setPassword('')
  }

  function handlePinInput(digit: string) {
    if (pin.length < 6) {
      const nextPin = pin + digit
      setPin(nextPin)
      if (nextPin.length === 6) void handlePinLogin(nextPin)
    }
  }

  async function handlePinLogin(value: string) {
    setLoading(true)
    setError('')
    const result = mode === 'owner'
      ? await loginOwnerWithPin(value)
      : mode === 'agent'
        ? await loginAgent(value)
        : await loginPhat(value)

    if (result.error) {
      setError(result.error)
      setPin('')
      setLoading(false)
      return
    }

    if (result.user) router.replace('/')
  }

  async function handleOwnerPasswordLogin() {
    setLoading(true)
    setError('')
    const result = await loginOwnerWithPassword(email, password)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    if (result.user) router.replace('/settings')
  }

  const showOwnerPin = mode === 'owner' && ownerHasPin !== false
  const showOwnerPassword = mode === 'owner' && ownerHasPin === false
  const showAgentPin = mode === 'agent'
  const showViewerPin = mode === 'viewer'

  const modeTitle = mode === 'owner' ? 'โทนี่' : mode === 'agent' ? 'เจ้หลุยส์' : 'เจ้ภัส'

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--black-900)' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>🪿</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)' }}>ห่านทองคำ</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>ระบบดูแลการลงทุน</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 16, padding: 4, gap: 4, marginBottom: 32, width: '100%', maxWidth: 360 }}>
        {([
          ['agent', 'เจ้หลุยส์'],
          ['owner', 'โทนี่'],
          ['viewer', 'เจ้ภัส'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => resetForm(value)}
            style={{
              flex: 1,
              padding: '12px 8px',
              borderRadius: 12,
              border: 'none',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: mode === value ? 'linear-gradient(135deg,#C9922A,#F2C94C)' : 'transparent',
              color: mode === value ? '#080808' : 'var(--text-muted)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {(showAgentPin || showOwnerPin || showViewerPin) && (
        <div style={{ width: '100%', maxWidth: 320, textAlign: 'center' }}>
          <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 24 }}>
            กรอก PIN {modeTitle} 6 หลัก
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 32 }}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: '2px solid',
                  borderColor: index < pin.length ? 'var(--gold)' : 'var(--border-hover)',
                  background: index < pin.length ? 'var(--gold)' : 'transparent',
                  transition: 'all 0.15s',
                }}
              />
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((digit, index) => (
              <button
                key={index}
                onClick={() => {
                  if (digit === '⌫') {
                    setPin((current) => current.slice(0, -1))
                    setError('')
                  } else if (digit !== '') {
                    handlePinInput(digit)
                  }
                }}
                disabled={loading || digit === ''}
                style={{
                  height: 68,
                  borderRadius: 16,
                  border: '1px solid var(--border)',
                  background: digit === '' ? 'transparent' : 'var(--black-700)',
                  color: 'var(--text-primary)',
                  fontSize: digit === '⌫' ? 22 : 24,
                  fontWeight: 600,
                  cursor: digit === '' ? 'default' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {digit}
              </button>
            ))}
          </div>

          {loading && <div style={{ color: 'var(--gold)', fontSize: 14, marginTop: 16 }}>กำลังตรวจสอบ...</div>}
        </div>
      )}

      {showOwnerPassword && (
        <div style={{ width: '100%', maxWidth: 320 }}>
          <div style={{ fontSize: 16, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 18 }}>
            เข้าแบบอีเมลเดิมก่อน แล้วค่อยไปตั้ง PIN ในหน้าตั้งค่า
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input className="input-field" type="email" placeholder="อีเมลโทนี่" value={email} onChange={(event) => setEmail(event.target.value)} />
            <input
              className="input-field"
              type="password"
              placeholder="รหัสผ่านเดิม"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleOwnerPasswordLogin()
              }}
            />
            <button className="btn-primary" type="button" onClick={handleOwnerPasswordLogin} disabled={loading}>
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าแบบเดิมเพื่อตั้ง PIN'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="danger-chip" style={{ marginTop: 20, borderRadius: 12, padding: '12px 16px', fontSize: 14, textAlign: 'center', maxWidth: 320, width: '100%' }}>
          {error}
        </div>
      )}
    </div>
  )
}
