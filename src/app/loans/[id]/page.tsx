import { notFound, redirect } from 'next/navigation'
import LoanDetailClient from '@/components/Loans/LoanDetailClient'
import { fetchLoanDetail } from '@/lib/server/loan-detail'
import { readPageSession } from '@/lib/server/page-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await readPageSession()
  if (!session) {
    redirect('/login')
  }

  const { id } = await params
  const initialData = await fetchLoanDetail(id)

  if (!initialData.loan) {
    notFound()
  }

  return <LoanDetailClient loanId={id} initialData={initialData} />
}
