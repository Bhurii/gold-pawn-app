import { NextRequest, NextResponse } from 'next/server'
import { readSessionFromRequest } from '@/lib/server/app-session'
import { hasOwnerPinRecord, loadSettingsState, maybeUpgradeLegacyPins, saveAgentPin, saveBudget, saveOwnerPin } from '@/lib/server/settings-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function GET(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) return unauthorized()

  await maybeUpgradeLegacyPins()
  const settings = await loadSettingsState()
  const hasOwnerPin = await hasOwnerPinRecord()

  return NextResponse.json({
    role: user.role,
    isAdmin: user.role === 'owner',
    budget: user.role === 'owner' ? settings.invest_budget : null,
    hasOwnerPin,
    hasAgentPin: settings.hasAgentPin,
  })
}

export async function PATCH(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) return unauthorized()

  await maybeUpgradeLegacyPins()
  const body = await request.json().catch(() => null)
  const updates: string[] = []

  if (typeof body?.budget === 'number') {
    if (user.role !== 'owner') return unauthorized()
    await saveBudget(body.budget)
    updates.push('budget')
  }

  if (typeof body?.ownerPin === 'string') {
    if (user.role !== 'owner') return unauthorized()
    if (!/^\d{6}$/.test(body.ownerPin)) {
      return NextResponse.json({ error: 'PIN โทนี่ต้องเป็นตัวเลข 6 หลัก' }, { status: 400 })
    }
    await saveOwnerPin(body.ownerPin)
    updates.push('ownerPin')
  }

  if (typeof body?.agentPin === 'string') {
    if (!/^\d{6}$/.test(body.agentPin)) {
      return NextResponse.json({ error: 'PIN เจ้หลุยส์ต้องเป็นตัวเลข 6 หลัก' }, { status: 400 })
    }
    await saveAgentPin(body.agentPin)
    updates.push('agentPin')
  }

  return NextResponse.json({ ok: true, updates })
}
