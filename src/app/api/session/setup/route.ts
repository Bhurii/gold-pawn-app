import { NextResponse } from 'next/server'
import { hasOwnerPinRecord, maybeUpgradeLegacyPins } from '@/lib/server/settings-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await maybeUpgradeLegacyPins()
    const hasOwnerPin = await hasOwnerPinRecord()
    return NextResponse.json({ hasOwnerPin })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Setup failed',
    }, { status: 500 })
  }
}
