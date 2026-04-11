'use client'
import { useState, useEffect } from 'react'

interface Props {
  value: string
  onChange: (val: string) => void
  label?: string
}

const MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
const MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
const DAYS = ['จ','อ','พ','พฤ','ศ','ส','อา']

function toCS(buddhistYear: number) { return buddhistYear - 543 }
function toBS(csYear: number) { return csYear + 543 }

export default function ThaiDatePicker({ value, onChange, label }: Props) {
  const today = new Date()
  const initYear = value ? new Date(value + 'T00:00:00').getFullYear() : today.getFullYear()
  const initMonth = value ? new Date(value + 'T00:00:00').getMonth() : today.getMonth()

  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(initYear)
  const [viewMonth, setViewMonth] = useState(initMonth)
  const [mode, setMode] = useState<'day' | 'month' | 'year'>('day')

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00')
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value])

  function getDays() {
    const first = new Date(viewYear, viewMonth, 1)
    const last = new Date(viewYear, viewMonth + 1, 0)
    const startDay = (first.getDay() + 6) % 7
    const days: (number | null)[] = []
    for (let i = 0; i < startDay; i++) days.push(null)
    for (let i = 1; i <= last.getDate(); i++) days.push(i)
    while (days.length % 7 !== 0) days.push(null)
    return days
  }

  function selectDay(day: number) {
    const d = new Date(viewYear, viewMonth, day)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    onChange(`${yyyy}-${mm}-${dd}`)
    setOpen(false)
  }

  function displayValue() {
    if (!value) return 'เลือกวันที่'
    const d = new Date(value + 'T00:00:00')
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${toBS(d.getFullYear())}`
  }

  const selectedDay = value ? new Date(value + 'T00:00:00').getDate() : -1
  const selectedMonth = value ? new Date(value + 'T00:00:00').getMonth() : -1
  const selectedYear = value ? new Date(value + 'T00:00:00').getFullYear() : -1

  const yearList = Array.from({ length: 20 }, (_, i) => today.getFullYear() - 5 + i)

  return (
    <div style={{ position: 'relative' }}>
      {label && <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>{label}</div>}
      <button type="button" onClick={() => setOpen(!open)}
        style={{ width: '100%', background: 'var(--black-700)', border: `1px solid ${open ? 'var(--gold)' : 'var(--border-hover)'}`, borderRadius: 14, padding: '15px 18px', color: value ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 17, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'border-color 0.15s' }}>
        <span style={{ fontWeight: value ? 700 : 400 }}>{displayValue()}</span>
        <span style={{ fontSize: 16, color: 'var(--gold)' }}>📅</span>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, background: 'var(--black-800)', border: '1px solid var(--border-hover)', borderRadius: 18, padding: 16, zIndex: 50, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button type="button" onClick={() => {
              if (mode === 'day') { const d = new Date(viewYear, viewMonth - 1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()) }
              else if (mode === 'year') setViewYear(v => v - 10)
            }}
              style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}>‹</button>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setMode(mode === 'month' ? 'day' : 'month')}
                style={{ background: mode === 'month' ? 'rgba(242,201,76,0.2)' : 'transparent', border: 'none', color: 'var(--gold)', fontSize: 16, fontWeight: 700, cursor: 'pointer', padding: '6px 12px', borderRadius: 8 }}>
                {MONTHS_SHORT[viewMonth]}
              </button>
              <button type="button" onClick={() => setMode(mode === 'year' ? 'day' : 'year')}
                style={{ background: mode === 'year' ? 'rgba(242,201,76,0.2)' : 'transparent', border: 'none', color: 'var(--gold)', fontSize: 16, fontWeight: 700, cursor: 'pointer', padding: '6px 12px', borderRadius: 8 }}>
                {toBS(viewYear)}
              </button>
            </div>

            <button type="button" onClick={() => {
              if (mode === 'day') { const d = new Date(viewYear, viewMonth + 1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()) }
              else if (mode === 'year') setViewYear(v => v + 10)
            }}
              style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}>›</button>
          </div>

          {/* Month picker */}
          {mode === 'month' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {MONTHS_SHORT.map((m, i) => (
                <button type="button" key={i} onClick={() => { setViewMonth(i); setMode('day') }}
                  style={{ padding: '10px 4px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, background: i === viewMonth ? 'linear-gradient(135deg,#C9922A,#F2C94C)' : 'var(--black-700)', color: i === viewMonth ? '#080808' : 'var(--text-primary)' }}>
                  {m}
                </button>
              ))}
            </div>
          )}

          {/* Year picker */}
          {mode === 'year' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {yearList.map(y => (
                <button type="button" key={y} onClick={() => { setViewYear(y); setMode('day') }}
                  style={{ padding: '10px 4px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, background: y === viewYear ? 'linear-gradient(135deg,#C9922A,#F2C94C)' : 'var(--black-700)', color: y === viewYear ? '#080808' : 'var(--text-primary)' }}>
                  {toBS(y)}
                </button>
              ))}
            </div>
          )}

          {/* Day picker */}
          {mode === 'day' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
                {DAYS.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', padding: '4px 0', fontWeight: 600 }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {getDays().map((day, i) => {
                  const isSelected = day === selectedDay && viewMonth === selectedMonth && viewYear === selectedYear
                  const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
                  return (
                    <button type="button" key={i} onClick={() => day && selectDay(day)} disabled={!day}
                      style={{ height: 36, borderRadius: 8, border: isToday && !isSelected ? '1px solid rgba(242,201,76,0.4)' : 'none', cursor: day ? 'pointer' : 'default', fontSize: 14, fontWeight: isSelected ? 700 : 400, background: isSelected ? 'linear-gradient(135deg,#C9922A,#F2C94C)' : 'transparent', color: !day ? 'transparent' : isSelected ? '#080808' : 'var(--text-primary)', transition: 'background 0.1s' }}>
                      {day || ''}
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                <button type="button" onClick={() => { onChange(''); setOpen(false) }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer', padding: '6px 12px' }}>ล้าง</button>
                <button type="button" onClick={() => { const t = today; selectDay(t.getDate()); setViewYear(t.getFullYear()); setViewMonth(t.getMonth()) }}
                  style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '6px 12px' }}>วันนี้</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
