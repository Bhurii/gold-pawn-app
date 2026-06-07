'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toThaiDateShort, fmt } from '@/lib/utils'
import BottomNav from '@/components/BottomNav'

const MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

type ReportState = {
  pawnInterest: number
  loanInterest: number
  budget: number
  activePawnsAmount: number
  activeLoansAmount: number
  pawnCount: number
  loanCount: number
}

type PawnInterestRow = {
  amount: number
  payment_date: string
  pawns?: { ticket_no?: string } | Array<{ ticket_no?: string }> | null
}

type RedemptionRow = {
  interest_last: number | null
  redeem_date: string
  pawns?: { ticket_no?: string } | Array<{ ticket_no?: string }> | null
}

type LoanInterestRow = {
  amount: number
  transaction_date: string
  loans?: { borrower_name?: string } | Array<{ borrower_name?: string }> | null
}

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

type SelectedPeriod = number | 'all'

function getDateRangeForYear(year: number) {
  return {
    firstDay: `${year}-01-01`,
    lastDay: `${year}-12-31`,
  }
}

function getMonthIndex(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).getMonth()
}

function relationFirst<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0]
  return value || null
}

export default function Report() {
  const router = useRouter()
  const currentYear = new Date().getFullYear()
  const [selectedPeriod, setSelectedPeriod] = useState<SelectedPeriod>(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [data, setData] = useState<ReportState>({
    pawnInterest: 0,
    loanInterest: 0,
    budget: 0,
    activePawnsAmount: 0,
    activeLoansAmount: 0,
    pawnCount: 0,
    loanCount: 0,
  })
  const [pawnDetails, setPawnDetails] = useState<PawnDetail[]>([])
  const [loanDetails, setLoanDetails] = useState<LoanDetail[]>([])
  const [monthlyData, setMonthlyData] = useState<number[]>(Array(12).fill(0))
  const [loading, setLoading] = useState(true)
  const [expandPawn, setExpandPawn] = useState(false)
  const [expandLoan, setExpandLoan] = useState(false)
  const [yearBudget, setYearBudget] = useState(0)
  const [yearPawned, setYearPawned] = useState(0)
  const [yearLoanPrincipal, setYearLoanPrincipal] = useState(0)
  const [yearInterests, setYearInterests] = useState<PawnInterestRow[]>([])
  const [yearRedemptions, setYearRedemptions] = useState<RedemptionRow[]>([])
  const [yearLoanTxns, setYearLoanTxns] = useState<LoanInterestRow[]>([])

  const availableYears = useMemo(() => {
    const firstSupportedYear = 2024
    const lastSupportedYear = currentYear + 1
    return Array.from({ length: lastSupportedYear - firstSupportedYear + 1 }, (_, index) => firstSupportedYear + index)
  }, [currentYear])

  useEffect(() => { loadYearData() }, [selectedYear])
  useEffect(() => { buildPeriodData() }, [selectedPeriod, yearBudget, yearPawned, yearLoanPrincipal, yearInterests, yearRedemptions, yearLoanTxns])

  async function loadYearData() {
    setLoading(true)
    const { firstDay, lastDay } = getDateRangeForYear(selectedYear)

    const [
      { data: settings },
      { data: interests },
      { data: redemptions },
      { data: loanTxns },
      { data: pawns },
      { data: loans },
    ] = await Promise.all([
      supabase.from('settings').select('invest_budget').single(),
      supabase.from('interest_payments').select('amount, payment_date, pawns(ticket_no)').gte('payment_date', firstDay).lte('payment_date', lastDay),
      supabase.from('redemptions').select('interest_last, redeem_date, pawns(ticket_no)').gte('redeem_date', firstDay).lte('redeem_date', lastDay),
      supabase.from('loan_transactions').select('amount, transaction_date, loans(borrower_name)').eq('type', 'interest').gte('transaction_date', firstDay).lte('transaction_date', lastDay),
      supabase.from('pawns').select('amount').eq('status', 'active').eq('tx_status', 'active'),
      supabase.from('loans').select('remaining_principal').eq('status', 'active'),
    ])

    setYearBudget(settings?.invest_budget || 0)
    setYearPawned(pawns?.reduce((sum: number, pawn: { amount: number }) => sum + pawn.amount, 0) || 0)
    setYearLoanPrincipal(loans?.reduce((sum: number, loan: { remaining_principal: number }) => sum + loan.remaining_principal, 0) || 0)
    setYearInterests((interests || []) as PawnInterestRow[])
    setYearRedemptions((redemptions || []) as RedemptionRow[])
    setYearLoanTxns((loanTxns || []) as LoanInterestRow[])
  }

  function buildPeriodData() {
    const nextMonthly = Array(12).fill(0)
    const nextPawnDetails: PawnDetail[] = []
    const nextLoanDetails: LoanDetail[] = []
    let pawnInterest = 0
    let loanInterest = 0

    yearInterests.forEach((interest) => {
      const month = getMonthIndex(interest.payment_date)
      nextMonthly[month] += interest.amount

      if (selectedPeriod === 'all' || month === selectedPeriod) {
        pawnInterest += interest.amount
        nextPawnDetails.push({
          ticket: relationFirst(interest.pawns)?.ticket_no,
          amount: interest.amount,
          date: interest.payment_date,
          type: 'ตัดดอก',
        })
      }
    })

    yearRedemptions.forEach((redemption) => {
      const amount = redemption.interest_last || 0
      const month = getMonthIndex(redemption.redeem_date)
      nextMonthly[month] += amount

      if (selectedPeriod === 'all' || month === selectedPeriod) {
        pawnInterest += amount
        nextPawnDetails.push({
          ticket: relationFirst(redemption.pawns)?.ticket_no,
          amount,
          date: redemption.redeem_date,
          type: 'ไถ่ถอน',
        })
      }
    })

    yearLoanTxns.forEach((txn) => {
      const month = getMonthIndex(txn.transaction_date)
      nextMonthly[month] += txn.amount

      if (selectedPeriod === 'all' || month === selectedPeriod) {
        loanInterest += txn.amount
        nextLoanDetails.push({
          name: relationFirst(txn.loans)?.borrower_name,
          amount: txn.amount,
          date: txn.transaction_date,
        })
      }
    })

    setMonthlyData(nextMonthly)
    setPawnDetails(nextPawnDetails.sort((a, b) => b.date.localeCompare(a.date)))
    setLoanDetails(nextLoanDetails.sort((a, b) => b.date.localeCompare(a.date)))
    setData({
      pawnInterest,
      loanInterest,
      budget: yearBudget,
      activePawnsAmount: yearPawned,
      activeLoansAmount: yearLoanPrincipal,
      pawnCount: nextPawnDetails.length,
      loanCount: nextLoanDetails.length,
    })
    setLoading(false)
  }

  const totalInterest = data.pawnInterest + data.loanInterest
  const totalInvested = data.activePawnsAmount + data.activeLoansAmount
  const remaining = data.budget - totalInvested
  const roiCurrent = data.budget > 0 ? ((totalInterest / data.budget) * 100).toFixed(2) : '0.00'
  const isYearView = selectedPeriod === 'all'
  const isCurrentYear = selectedYear === currentYear
  const maxBar = Math.max(...monthlyData, 1)
  const periodLabel = isYearView ? `ทั้งปี ${selectedYear + 543}` : `${MONTHS_SHORT[selectedPeriod]} ${selectedYear + 543}`
  const currentRoiLabel = isYearView ? 'ROI ทั้งปี' : 'ROI เดือนนี้'
  const secondaryRoiLabel = isYearView ? 'เฉลี่ยต่อเดือน' : 'ROI ต่อปี'
  const secondaryRoiValue = isYearView
    ? (data.budget > 0 ? ((totalInterest / data.budget) * 100 / 12).toFixed(2) : '0.00')
    : (data.budget > 0 ? ((totalInterest / data.budget) * 12 * 100).toFixed(1) : '0.0')

  return (
    <main className="page-container">
      <div style={{ padding: '56px 0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gold)' }}>📊 ผลผลิต</div>
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
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>🥚 ไข่รายเดือน พ.ศ. {selectedYear + 543}</div>
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
          {monthlyData.map((val, index) => (
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
          {isYearView ? `ดูยอดรวมทั้งปี ${selectedYear + 543}` : `กำลังดูเดือน ${MONTHS_SHORT[selectedPeriod]} ${selectedYear + 543}`}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--gold)', padding: 40, fontSize: 18 }}>กำลังโหลด...</div>
      ) : (
        <>
          <div className="panel-gold" style={{ padding: 20, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>🥚 ไข่ทั้งหมด {periodLabel}</div>
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
            <div
              onClick={() => setExpandPawn(!expandPawn)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
            >
              <span style={{ fontSize: 28 }}>🥚</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>ไข่จากห่านทองคำ</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{data.pawnCount} รายการ</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold)' }}>฿{fmt(data.pawnInterest)}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', transform: expandPawn ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>⌄</div>
              </div>
            </div>
            {expandPawn && pawnDetails.length > 0 && (
              <div style={{ marginTop: 14, borderTop: '0.5px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pawnDetails.map((detail, index) => (
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
            {expandPawn && pawnDetails.length === 0 && (
              <div style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 14, textAlign: 'center' }}>
                {isYearView ? 'ไม่มีรายการในปีนี้' : 'ไม่มีรายการเดือนนี้'}
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div
              onClick={() => setExpandLoan(!expandLoan)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
            >
              <span style={{ fontSize: 28 }}>🍊</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>ผลผลิตจากสวนผลไม้</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{data.loanCount} รายการ</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold)' }}>฿{fmt(data.loanInterest)}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', transform: expandLoan ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>⌄</div>
              </div>
            </div>
            {expandLoan && loanDetails.length > 0 && (
              <div style={{ marginTop: 14, borderTop: '0.5px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {loanDetails.map((detail, index) => (
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
            {expandLoan && loanDetails.length === 0 && (
              <div style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 14, textAlign: 'center' }}>
                {isYearView ? 'ไม่มีรายการในปีนี้' : 'ไม่มีรายการเดือนนี้'}
              </div>
            )}
          </div>

          {!isCurrentYear && (
            <div className="info-note">
              ตอนนี้คุณกำลังดูรายได้ของปี {selectedYear + 543} แต่ตัวเลขด้านล่างยังเป็นภาพรวมปัจจุบันของพอร์ต เพื่อไม่ให้เข้าใจว่าเป็น snapshot ย้อนหลังของปีนั้น
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
