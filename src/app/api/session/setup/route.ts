import { NextResponse } from 'next/server'
import { hasOwnerPinRecord } from '@/lib/server/settings-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const hasOwnerPin = await hasOwnerPinRecord()
    return NextResponse.json({ hasOwnerPin })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
