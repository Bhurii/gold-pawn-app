import { notFound, redirect } from 'next/navigation'
import PawnDetailClient from '@/components/Pawns/PawnDetailClient'
import { fetchPawnDetail } from '@/lib/server/pawn-detail'
import { readPageSession } from '@/lib/server/page-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function PawnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await readPageSession()
  if (!session) {
    redirect('/login')
  }

  const { id } = await params
  const initialData = await fetchPawnDetail(id)

  if (!initialData.pawn) {
    notFound()
  }

  return <PawnDetailClient pawnId={id} initialData={initialData} />
}
