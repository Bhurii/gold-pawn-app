import { NextResponse } from 'next/server'
import { hasOwnerPinRecord, maybeUpgradeLegacyPins } from '@/lib/server/settings-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  await maybeUpgradeLegacyPins()
  const hasOwnerPin = await hasOwnerPinRecord()
  return NextResponse.json({ hasOwnerPin })
}
