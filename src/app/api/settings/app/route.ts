import { NextRequest, NextResponse } from 'next/server'
import { isFundOwnerKey } from '@/lib/fund-owner'
import { deleteMemoryCache, getOrSetMemoryCache } from '@/lib/server/memory-cache'
import { readSessionFromRequest } from '@/lib/server/app-session'
import { hasOwnerPinRecord, loadSettingsState, saveAgentPin, saveBudget, saveOwnerPin, savePhatPin } from '@/lib/server/settings-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function GET(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) return unauthorized()

  const settings = await getOrSetMemoryCache('api:settings:state', 30000, () => loadSettingsState())
  const hasOwnerPin = await getOrSetMemoryCache('api:settings:owner-pin', 30000, () => hasOwnerPinRecord())

  return NextResponse.json({
    role: user.role,
    userKey: user.user_key,
    isAdmin: user.role === 'owner',
    budget: settings.budgets[user.user_key] ?? 0,
    budgets: settings.budgets,
    hasOwnerPin,
    hasAgentPin: settings.hasAgentPin,
    hasPhatPin: settings.hasPhatPin,
  })
}

export async function PATCH(request: NextRequest) {
  const user = readSessionFromRequest(request)
  if (!user) return unauthorized()

  const body = await request.json().catch(() => null)
  const updates: string[] = []

  if (typeof body?.budget === 'number') {
    const requestedOwner = typeof body?.budgetOwner === 'string' && isFundOwnerKey(body.budgetOwner)
      ? body.budgetOwner
      : user.user_key

    if (user.role !== 'owner' && requestedOwner !== user.user_key) {
      return unauthorized()
    }

    await saveBudget(requestedOwner, body.budget)
    deleteMemoryCache('api:settings:state')
    updates.push(`budget:${requestedOwner}`)
  }

  if (typeof body?.ownerPin === 'string') {
    if (user.role !== 'owner') return unauthorized()
    if (!/^\d{6}$/.test(body.ownerPin)) {
      return NextResponse.json({ error: 'PIN โทนี่ต้องเป็นตัวเลข 6 หลัก' }, { status: 400 })
    }
    await saveOwnerPin(body.ownerPin)
    deleteMemoryCache('api:settings:owner-pin')
    updates.push('ownerPin')
  }

  if (typeof body?.agentPin === 'string') {
    if (user.role !== 'owner' && user.user_key !== 'louise') return unauthorized()
    if (!/^\d{6}$/.test(body.agentPin)) {
      return NextResponse.json({ error: 'PIN เจ้หลุยส์ต้องเป็นตัวเลข 6 หลัก' }, { status: 400 })
    }
    await saveAgentPin(body.agentPin)
    deleteMemoryCache('api:settings:state')
    updates.push('agentPin')
  }

  if (typeof body?.phatPin === 'string') {
    if (user.role !== 'owner' && user.user_key !== 'phat') return unauthorized()
    if (!/^\d{6}$/.test(body.phatPin)) {
      return NextResponse.json({ error: 'PIN เจ้ภัสต้องเป็นตัวเลข 6 หลัก' }, { status: 400 })
    }
    await savePhatPin(body.phatPin)
    deleteMemoryCache('api:settings:state')
    updates.push('phatPin')
  }

  return NextResponse.json({ ok: true, updates })
}
