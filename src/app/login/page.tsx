'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginOwner, loginAgent } from '@/lib/auth'

export default function Login() {
  const router = useRouter()
  const [mode, setMode] = useState<'owner' | 'agent'>('agent')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handlePinInput(digit: string) {
    if (pin.length < 6) {
      const newPin = pin + digit
      setPin(newPin)
      if (newPin.length === 6) handlePinLogin(newPin)
    }
  }

  async function handlePinLogin(p: string) {
    setLoading(true)
    setError('')
    const { user, error: err } = await loginAgent(p)
    if (err) { setError(err); setPin(''); setLoading(false); return }
    if (user) router.replace('/')
  }

  async function handleOwnerLogin() {
    setLoading(true)
    setError('')
    const { user, error: err } = await loginOwner(email, password)
    if (err) { setError(err); setLoading(false); return }
    if (user) router.replace('/')
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 24px', background: 'var(--black-900)' }}>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>🪿</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)', letterSpacing: -0.5 }}>ห่านทองคำ</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>ระบบดูแลการลงทุน</div>
      </div>

      {/* Toggle */}
      <div style={{ display: 'flex', background: 'var(--black-700)', borderRadius: 16, padding: 4, gap: 4, marginBottom: 32, width: '100%', maxWidth: 320 }}>
        <button onClick={() => { setMode('agent'); setError(''); setPin('') }}
          style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', fontWeight: 700, fontSize: 15, cursor: 'pointer', transition: 'all 0.2s', background: mode === 'agent' ? 'linear-gradient(135deg,#C9922A,#F2C94C)' : 'transparent', color: mode === 'agent' ? '#080808' : 'var(--text-muted)' }}>
          เจ้หลุยส์
        </button>
        <button onClick={() => { setMode('owner'); setError(''); setPin('') }}
          style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', fontWeight: 700, fontSize: 15, cursor: 'pointer', transition: 'all 0.2s', background: mode === 'owner' ? 'linear-gradient(135deg,#C9922A,#F2C94C)' : 'transparent', color: mode === 'owner' ? '#080808' : 'var(--text-muted)' }}>
          โทนี่ชาวสวน
        </button>
      </div>

      {/* Agent PIN */}
      {mode === 'agent' && (
        <div style={{ width: '100%', maxWidth: 320, textAlign: 'center' }}>
          <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 24 }}>กรอก PIN 6 หลัก</div>

          {/* PIN dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 32 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid', borderColor: i < pin.length ? 'var(--gold)' : 'var(--border-hover)', background: i < pin.length ? 'var(--gold)' : 'transparent', transition: 'all 0.15s' }} />
            ))}
          </div>

          {/* Numpad */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
              <button key={i} onClick={() => {
                if (d === '⌫') { setPin(p => p.slice(0, -1)); setError('') }
                else if (d !== '') handlePinInput(d)
              }}
                disabled={loading || d === ''}
                style={{ height: 68, borderRadius: 16, border: '1px solid var(--border)', background: d === '' ? 'transparent' : 'var(--black-700)', color: 'var(--text-primary)', fontSize: d === '⌫' ? 22 : 24, fontWeight: 600, cursor: d === '' ? 'default' : 'pointer', transition: 'background 0.1s', opacity: loading ? 0.5 : 1 }}>
                {d}
              </button>
            ))}
          </div>

          {loading && <div style={{ color: 'var(--gold)', fontSize: 14, marginTop: 16 }}>กำลังตรวจสอบ...</div>}
        </div>
      )}

      {/* Owner Email/Password */}
      {mode === 'owner' && (
        <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>อีเมล</div>
            <input className="input-field" type="email" placeholder="your@email.com"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleOwnerLogin()} />
          </div>
          <div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>รหัสผ่าน</div>
            <input className="input-field" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleOwnerLogin()} />
          </div>
          <button className="btn-primary" onClick={handleOwnerLogin} disabled={loading} style={{ fontSize: 17, marginTop: 8 }}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 20, background: 'rgba(162,45,45,0.3)', border: '0.5px solid rgba(240,149,149,0.3)', borderRadius: 12, padding: '12px 16px', color: '#F09595', fontSize: 14, textAlign: 'center', maxWidth: 320, width: '100%' }}>
          {error}
        </div>
      )}
    </div>
  )
}
