'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toThaiDateShort, fmt } from '@/lib/utils'
import BottomNav from '@/components/BottomNav'

const MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

type PawnDetail = {
  ticket?: string
  amount: number
  date: string
  type: string
}

type LoanDetail = {
  name?: string
  amount: number
  date: string
}

type ReportPayload = {
  budget: number
  activePawnsAmount: number
  activeLoansAmount: number
  monthlyData: number[]
  pawnDetails: PawnDetail[]
  loanDetails: LoanDetail[]
}

type SelectedPeriod = number | 'all'

function getMonthIndex(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).getMonth()
}

export default function Report() {
  const router = useRouter()
  const currentYear = new Date().getFullYear()
  const [selectedPeriod, setSelectedPeriod] = useState<SelectedPeriod>(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [report, setReport] = useState<ReportPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandPawn, setExpandPawn] = useState(false)
  const [expandLoan, setExpandLoan] = useState(false)

  const availableYears = useMemo(() => {
    const firstSupportedYear = 2024
    const lastSupportedYear = currentYear + 1
    return Array.from({ length: lastSupportedYear - firstSupportedYear + 1 }, (_, index) => firstSupportedYear + index)
  }, [currentYear])

  useEffect(() => {
    void loadYearData(selectedYear)
  }, [selectedYear])

  async function loadYearData(year: number) {
    setLoading(true)
    try {
      const response = await fetch(`/api/report-summary?year=${year}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'โหลดข้อมูลรายงานไม่สำเร็จ')
      }
      setReport(payload as ReportPayload)
    } finally {
      setLoading(false)
    }
  }

  const safeReport = report || {
    budget: 0,
    activePawnsAmount: 0,
    activeLoansAmount: 0,
    monthlyData: Array(12).fill(0),
    pawnDetails: [] as PawnDetail[],
    loanDetails: [] as LoanDetail[],
  }

  const filteredPawnDetails = useMemo(
    () => safeReport.pawnDetails.filter((detail) => selectedPeriod === 'all' || getMonthIndex(detail.date) === selectedPeriod),
    [safeReport.pawnDetails, selectedPeriod],
  )

  const filteredLoanDetails = useMemo(
    () => safeReport.loanDetails.filter((detail) => selectedPeriod === 'all' || getMonthIndex(detail.date) === selectedPeriod),
    [safeReport.loanDetails, selectedPeriod],
  )

  const selectedMonthIndex = typeof selectedPeriod === 'number' ? selectedPeriod : new Date().getMonth()
  const pawnInterest = filteredPawnDetails.reduce((sum, detail) => sum + detail.amount, 0)
  const loanInterest = filteredLoanDetails.reduce((sum, detail) => sum + detail.amount, 0)
  const totalInterest = pawnInterest + loanInterest
  const totalInvested = safeReport.activePawnsAmount + safeReport.activeLoansAmount
  const remaining = safeReport.budget - totalInvested
  const roiCurrent = safeReport.budget > 0 ? ((totalInterest / safeReport.budget) * 100).toFixed(2) : '0.00'
  const isYearView = selectedPeriod === 'all'
  const isCurrentYear = selectedYear === currentYear
  const maxBar = Math.max(...safeReport.monthlyData, 1)
  const periodLabel = isYearView ? `ทั้งปี ${selectedYear + 543}` : `${MONTHS_SHORT[selectedMonthIndex]} ${selectedYear + 543}`
  const currentRoiLabel = isYearView ? 'ROI ทั้งปี' : 'ROI เดือนนี้'
  const secondaryRoiLabel = isYearView ? 'เฉลี่ยต่อเดือน' : 'ROI ต่อปี'
  const secondaryRoiValue = isYearView
    ? (safeReport.budget > 0 ? ((totalInterest / safeReport.budget) * 100 / 12).toFixed(2) : '0.00')
    : (safeReport.budget > 0 ? ((totalInterest / safeReport.budget) * 12 * 100).toFixed(1) : '0.0')

  return (
    <main className="page-container">
      <div style={{ padding: '56px 0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gold)' }}>📊 รายงาน</div>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="input-field"
          style={{ width: 'auto', padding: '8px 14px', fontSize: 15 }}
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>{year + 543}</option>
          ))}
        </select>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>📈 รายได้รายเดือน พ.ศ. {selectedYear + 543}</div>
          <button
            type="button"
            className="filter-chip"
            data-active={isYearView}
            onClick={() => setSelectedPeriod('all')}
            style={{ minWidth: 68 }}
          >
            ทั้งปี
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, marginBottom: 8 }}>
          {safeReport.monthlyData.map((val, index) => (
            <div
              key={index}
              onClick={() => setSelectedPeriod(index)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}
            >
              <div
                style={{
                  width: '100%',
                  borderRadius: '4px 4px 0 0',
                  height: `${Math.max((val / maxBar) * 70, val > 0 ? 6 : 2)}px`,
                  background: !isYearView && index === selectedPeriod
                    ? 'linear-gradient(180deg,#F2C94C,#C9922A)'
                    : val > 0 ? 'rgba(242,201,76,0.45)' : 'rgba(255,255,255,0.08)',
                  transition: 'height 0.3s',
                }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {MONTHS_SHORT.map((month, index) => (
            <div
              key={index}
              onClick={() => setSelectedPeriod(index)}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 9,
                color: !isYearView && index === selectedPeriod ? 'var(--gold)' : 'var(--text-muted)',
                fontWeight: !isYearView && index === selectedPeriod ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              {month.replace('.', '')}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
          {isYearView ? `ดูยอดรวมทั้งปี ${selectedYear + 543}` : `กำลังดูเดือน ${MONTHS_SHORT[selectedMonthIndex]} ${selectedYear + 543}`}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--gold)', padding: 40, fontSize: 18 }}>กำลังโหลด...</div>
      ) : (
        <>
          <div className="panel-gold" style={{ padding: 20, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>📈 รายได้รวม {periodLabel}</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--gold)', marginBottom: 4 }}>฿{fmt(totalInterest)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{currentRoiLabel}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>{roiCurrent}%</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{secondaryRoiLabel}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>{secondaryRoiValue}%</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div onClick={() => setExpandPawn(!expandPawn)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <span style={{ fontSize: 28 }}>🥚</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>ดอกจากจำนำทอง</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{filteredPawnDetails.length} รายการ</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold)' }}>฿{fmt(pawnInterest)}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', transform: expandPawn ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>⌄</div>
              </div>
            </div>
            {expandPawn && filteredPawnDetails.length > 0 && (
              <div style={{ marginTop: 14, borderTop: '0.5px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredPawnDetails.map((detail, index) => (
                  <div
                    key={index}
                    onClick={() => router.push(`/pawns?search=${detail.ticket}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '6px 0' }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(242,201,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🥚</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>ตั๋ว #{detail.ticket}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{toThaiDateShort(detail.date)} · {detail.type}</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold-light)' }}>+฿{fmt(detail.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div onClick={() => setExpandLoan(!expandLoan)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <span style={{ fontSize: 28 }}>🍊</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>ดอกจากสินเชื่อ</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{filteredLoanDetails.length} รายการ</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold)' }}>฿{fmt(loanInterest)}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', transform: expandLoan ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>⌄</div>
              </div>
            </div>
            {expandLoan && filteredLoanDetails.length > 0 && (
              <div style={{ marginTop: 14, borderTop: '0.5px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredLoanDetails.map((detail, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(242,201,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🍊</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{detail.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{toThaiDateShort(detail.date)}</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold-light)' }}>+฿{fmt(detail.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!isCurrentYear && (
            <div className="info-note">
              ตอนนี้คุณกำลังดูรายได้ของปี {selectedYear + 543} แต่ตัวเลขด้านล่างยังเป็นภาพรวมปัจจุบันของพอร์ต
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                {isCurrentYear ? 'เงินลงทุนคงเหลือ' : 'เงินลงทุนคงเหลือปัจจุบัน'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>฿{fmt(remaining)}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                {isCurrentYear ? 'มูลค่ารวม' : 'มูลค่ารวมปัจจุบัน'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold-light)' }}>฿{fmt(totalInvested)}</div>
            </div>
          </div>
        </>
      )}

      <BottomNav />
      <div style={{ height: 32 }} />
    </main>
  )
}
