'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toThaiDateShort, fmt } from '@/lib/utils'

const MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

type ReportState = {
  pawnInterest: number
  loanInterest: number
  budget: number
  pawned: number
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
  const [selectedPeriod, setSelectedPeriod] = useState<SelectedPeriod>(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [data, setData] = useState<ReportState>({ pawnInterest: 0, loanInterest: 0, budget: 0, pawned: 0, pawnCount: 0, loanCount: 0 })
  const [pawnDetails, setPawnDetails] = useState<PawnDetail[]>([])
  const [loanDetails, setLoanDetails] = useState<LoanDetail[]>([])
  const [monthlyData, setMonthlyData] = useState<number[]>(Array(12).fill(0))
  const [loading, setLoading] = useState(true)
  const [expandPawn, setExpandPawn] = useState(false)
  const [expandLoan, setExpandLoan] = useState(false)
  const [yearBudget, setYearBudget] = useState(0)
  const [yearPawned, setYearPawned] = useState(0)
  const [yearInterests, setYearInterests] = useState<PawnInterestRow[]>([])
  const [yearRedemptions, setYearRedemptions] = useState<RedemptionRow[]>([])
  const [yearLoanTxns, setYearLoanTxns] = useState<LoanInterestRow[]>([])

  useEffect(() => { loadYearData() }, [selectedYear])
  useEffect(() => { buildPeriodData() }, [selectedPeriod, yearBudget, yearPawned, yearInterests, yearRedemptions, yearLoanTxns])

  async function loadYearData() {
    setLoading(true)
    const { firstDay, lastDay } = getDateRangeForYear(selectedYear)

    const [{ data: settings }, { data: interests }, { data: redemptions }, { data: loanTxns }, { data: pawns }] = await Promise.all([
      supabase.from('settings').select('invest_budget').single(),
      supabase.from('interest_payments').select('amount, payment_date, pawns(ticket_no)').gte('payment_date', firstDay).lte('payment_date', lastDay),
      supabase.from('redemptions').select('interest_last, redeem_date, pawns(ticket_no)').gte('redeem_date', firstDay).lte('redeem_date', lastDay),
      supabase.from('loan_transactions').select('amount, transaction_date, loans(borrower_name)').eq('type', 'interest').gte('transaction_date', firstDay).lte('transaction_date', lastDay),
      supabase.from('pawns').select('amount').eq('status', 'active').eq('tx_status', 'active'),
    ])

    setYearBudget(settings?.invest_budget || 0)
    setYearPawned(pawns?.reduce((sum: number, pawn: { amount: number }) => sum + pawn.amount, 0) || 0)
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
      pawned: yearPawned,
      pawnCount: nextPawnDetails.length,
      loanCount: nextLoanDetails.length,
    })
    setLoading(false)
  }

  const totalInterest = data.pawnInterest + data.loanInterest
  const roiCurrent = data.budget > 0 ? ((totalInterest / data.budget) * 100).toFixed(2) : '0.00'
  const roiAnnual = data.budget > 0 ? ((totalInterest / data.budget) * (selectedPeriod === 'all' ? 100 : 12 * 100)).toFixed(selectedPeriod === 'all' ? 2 : 1) : (selectedPeriod === 'all' ? '0.00' : '0.0')
  const maxBar = Math.max(...monthlyData, 1)
  const isYearView = selectedPeriod === 'all'
  const periodLabel = isYearView ? `ทั้งปี ${selectedYear + 543}` : `${MONTHS_SHORT[selectedPeriod]} ${selectedYear + 543}`
  const currentRoiLabel = isYearView ? 'ROI ทั้งปี' : 'ROI เดือนนี้'
  const annualRoiLabel = isYearView ? 'เฉลี่ยต่อเดือน' : 'ROI ต่อปี'
  const annualRoiValue = isYearView
    ? (data.budget > 0 ? ((totalInterest / data.budget) * 100 / 12).toFixed(2) : '0.00')
    : roiAnnual

  return (
    <main className="page-container">
      <div style={{ padding: '56px 0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gold)' }}>📊 ผลผลิต</div>
        <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="input-field" style={{ width: 'auto', padding: '8px 14px', fontSize: 15 }}>
          {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y + 543}</option>)}
        </select>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 14 }}>🥚 ไข่รายเดือน พ.ศ. {selectedYear + 543}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, marginBottom: 8 }}>
          {monthlyData.map((val, i) => (
            <div key={i} onClick={() => setSelectedPeriod(i)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
              <div style={{
                width: '100%', borderRadius: '4px 4px 0 0',
                height: `${Math.max((val / maxBar) * 70, val > 0 ? 6 : 2)}px`,
                background: isYearView
                  ? (val > 0 ? 'rgba(242,201,76,0.7)' : 'rgba(255,255,255,0.08)')
                  : i === selectedPeriod
                    ? 'linear-gradient(180deg,#F2C94C,#C9922A)'
                    : val > 0 ? 'rgba(242,201,76,0.4)' : 'rgba(255,255,255,0.08)',
                transition: 'height 0.3s',
              }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {MONTHS_SHORT.map((m, i) => (
            <div key={i} onClick={() => setSelectedPeriod(i)}
              style={{ flex: 1, textAlign: 'center', fontSize: 9, color: !isYearView && i === selectedPeriod ? 'var(--gold)' : 'var(--text-muted)', fontWeight: !isYearView && i === selectedPeriod ? 700 : 400, cursor: 'pointer' }}>
              {m.replace('.', '')}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        <select value={isYearView ? 'all' : String(selectedPeriod)} onChange={(e) => setSelectedPeriod(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="input-field" style={{ flex: 1, padding: '10px 14px', fontSize: 15 }}>
          <option value="all">ทั้งปี</option>
          {MONTHS_SHORT.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>พ.ศ. {selectedYear + 543}</div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--gold)', padding: 40, fontSize: 18 }}>กำลังโหลด...</div>
      ) : (
        <>
          <div style={{ background: 'linear-gradient(135deg,#180F00,#2C1A00)', border: '1px solid rgba(242,201,76,0.35)', borderRadius: 20, padding: 20, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>🥚 ไข่ทั้งหมด {periodLabel}</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--gold)', marginBottom: 4 }}>฿{fmt(totalInterest)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{currentRoiLabel}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>{roiCurrent}%</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{annualRoiLabel}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>{annualRoiValue}%</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div onClick={() => setExpandPawn(!expandPawn)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
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
                {pawnDetails.map((d, i) => (
                  <div key={i} onClick={() => router.push(`/pawns?search=${d.ticket}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '6px 0' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(242,201,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🥚</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>ตั๋ว #{d.ticket}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{toThaiDateShort(d.date)} · {d.type}</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#6fcf6f' }}>+฿{fmt(d.amount)}</div>
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
            <div onClick={() => setExpandLoan(!expandLoan)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <span style={{ fontSize: 28 }}>🍊</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>ผลส้มจากทุ่งนา</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{data.loanCount} รายการ</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold)' }}>฿{fmt(data.loanInterest)}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', transform: expandLoan ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>⌄</div>
              </div>
            </div>
            {expandLoan && loanDetails.length > 0 && (
              <div style={{ marginTop: 14, borderTop: '0.5px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {loanDetails.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(242,201,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🍊</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{d.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{toThaiDateShort(d.date)}</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#6fcf6f' }}>+฿{fmt(d.amount)}</div>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>🏡 มูลค่าฟาร์ม</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#85b7eb' }}>฿{fmt(data.pawned)}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>🌾 ข้าวบาร์เลย์</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>฿{fmt(data.budget - data.pawned)}</div>
            </div>
          </div>
        </>
      )}

      <nav className="bottom-nav">
        <a href="/" className="nav-item"><span className="nav-icon">🥚</span>หน้าแรก</a>
        <a href="/pawns" className="nav-item"><span className="nav-icon">📋</span>ฝูงห่าน</a>
        <a href="/loans" className="nav-item"><span className="nav-icon">🍊</span>สวนส้ม</a>
        <a href="/report" className="nav-item active"><span className="nav-icon">📊</span>ผลผลิต</a>
      </nav>
      <div style={{ height: 32 }} />
    </main>
  )
}
