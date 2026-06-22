import { createAdminClient } from '@/lib/server/admin'
import { hashPin, isHashedPin, verifyPin } from '@/lib/server/pin'
import type { FundOwnerKey } from '@/lib/fund-owner'

const OWNER_PIN_TYPE = 'owner_pin_config'
const AGENT_PIN_TYPE = 'agent_pin_config'
const PHAT_PIN_TYPE = 'phat_pin_config'
const BUDGET_TYPES: Record<FundOwnerKey, string> = {
  tony: 'budget_config_tony',
  louise: 'budget_config_louise',
  phat: 'budget_config_phat',
}

type OwnerPinRecord = {
  hash?: string
  pin?: string
  updatedAt: string
}

type AgentPinRecord = {
  hash?: string
  pin?: string
  updatedAt: string
}

type BudgetRecord = {
  amount?: number
  updatedAt: string
}

async function readSettingsRow() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('settings')
    .select('id, invest_budget, agent_pin, agent_pin_hash')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return data || null
}

async function loadPinRecord(type: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('id, message')
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  if (!data?.message) return null

  try {
    return {
      id: data.id,
      record: JSON.parse(data.message) as { hash?: string; pin?: string; updatedAt: string },
    }
  } catch {
    return null
  }
}

async function savePinRecord(type: string, hash: string) {
  const supabase = createAdminClient()
  const payload = {
    hash,
    updatedAt: new Date().toISOString(),
  }
  const current = await loadPinRecord(type)

  if (current?.id) {
    const { error } = await supabase
      .from('notifications')
      .update({ message: JSON.stringify(payload), is_read: true })
      .eq('id', current.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('notifications').insert({
    type,
    message: JSON.stringify(payload),
    is_read: true,
  })
  if (error) throw error
}

export async function ensureSettingsRow() {
  const supabase = createAdminClient()
  const existing = await readSettingsRow()
  if (existing) return existing

  const { data, error } = await supabase
    .from('settings')
    .insert({ invest_budget: 0 })
    .select('id, invest_budget, agent_pin, agent_pin_hash')
    .single()

  if (error) throw error
  return data
}

export async function loadSettingsState() {
  const settings = await readSettingsRow()
  const agentRecord = await loadPinRecord(AGENT_PIN_TYPE)
  const phatRecord = await loadPinRecord(PHAT_PIN_TYPE)
  const budgets = await loadBudgetState()

  return {
    id: settings?.id || '',
    invest_budget: budgets.tony,
    budgets,
    hasAgentPin: Boolean(agentRecord?.record?.hash || agentRecord?.record?.pin || settings?.agent_pin_hash || settings?.agent_pin),
    hasPhatPin: Boolean(phatRecord?.record?.hash || phatRecord?.record?.pin),
  }
}

async function loadBudgetRecord(owner: FundOwnerKey) {
  const current = await loadPinRecord(BUDGET_TYPES[owner])
  if (!current) return null
  return {
    id: current.id,
    record: current.record as BudgetRecord,
  }
}

async function saveBudgetRecord(owner: FundOwnerKey, amount: number) {
  const supabase = createAdminClient()
  const payload = {
    amount,
    updatedAt: new Date().toISOString(),
  }
  const current = await loadBudgetRecord(owner)

  if (current?.id) {
    const { error } = await supabase
      .from('notifications')
      .update({ message: JSON.stringify(payload), is_read: true })
      .eq('id', current.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('notifications').insert({
    type: BUDGET_TYPES[owner],
    message: JSON.stringify(payload),
    is_read: true,
  })
  if (error) throw error
}

export async function loadBudgetState(): Promise<Record<FundOwnerKey, number>> {
  const settings = await readSettingsRow()
  const base: Record<FundOwnerKey, number> = {
    tony: Number(settings?.invest_budget || 0),
    louise: 0,
    phat: 0,
  }

  for (const owner of Object.keys(BUDGET_TYPES) as FundOwnerKey[]) {
    const record = await loadBudgetRecord(owner)
    const amount = Number(record?.record?.amount)
    if (Number.isFinite(amount) && amount >= 0) {
      base[owner] = amount
    }
  }

  return base
}

export function getBudgetForScope(budgets: Record<FundOwnerKey, number>, scope: FundOwnerKey | 'all') {
  if (scope === 'all') {
    return budgets.tony + budgets.louise + budgets.phat
  }
  return budgets[scope] || 0
}

export async function saveBudget(owner: FundOwnerKey, investBudget: number) {
  await saveBudgetRecord(owner, investBudget)

  if (owner !== 'tony') {
    return
  }

  const supabase = createAdminClient()
  const settings = await ensureSettingsRow()
  const { error } = await supabase
    .from('settings')
    .update({ invest_budget: investBudget, updated_at: new Date().toISOString() })
    .eq('id', settings.id)

  if (error) throw error
}

export async function saveAgentPin(pin: string) {
  const pinHash = hashPin(pin)

  await savePinRecord(AGENT_PIN_TYPE, pinHash)

  try {
    const supabase = createAdminClient()
    const settings = await ensureSettingsRow()
    const { error } = await supabase
      .from('settings')
      .update({
        agent_pin: null,
        agent_pin_hash: pinHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id)

    if (error) {
      console.warn('Failed to mirror agent PIN into settings:', error.message)
    }
  } catch (error) {
    console.warn('Failed to mirror agent PIN into settings:', error)
  }
}

export async function verifyAgentPin(pin: string) {
  const record = await loadPinRecord(AGENT_PIN_TYPE)
  const storedFromNotification = record?.record?.hash || record?.record?.pin
  if (storedFromNotification) {
    return verifyPin(storedFromNotification, pin)
  }

  const settings = await readSettingsRow()
  if (!settings) return false
  return verifyPin(settings.agent_pin_hash || settings.agent_pin, pin)
}

async function loadOwnerPinRecord() {
  const current = await loadPinRecord(OWNER_PIN_TYPE)
  if (!current) return null
  return {
    id: current.id,
    record: current.record as OwnerPinRecord,
  }
}

export async function hasOwnerPinRecord() {
  const current = await loadOwnerPinRecord()
  return Boolean(current?.record?.hash || current?.record?.pin)
}

export async function saveOwnerPin(pin: string) {
  await savePinRecord(OWNER_PIN_TYPE, hashPin(pin))
}

export async function verifyOwnerPin(pin: string) {
  const current = await loadOwnerPinRecord()
  const stored = current?.record?.hash || current?.record?.pin
  return verifyPin(stored, pin)
}

export async function savePhatPin(pin: string) {
  await savePinRecord(PHAT_PIN_TYPE, hashPin(pin))
}

export async function verifyPhatPin(pin: string) {
  const record = await loadPinRecord(PHAT_PIN_TYPE)
  const stored = record?.record?.hash || record?.record?.pin
  return verifyPin(stored, pin)
}

export async function maybeUpgradeLegacyPins() {
  const supabase = createAdminClient()
  const settings = await ensureSettingsRow()

  if (settings.agent_pin && !isHashedPin(settings.agent_pin_hash)) {
    const pinHash = hashPin(settings.agent_pin)
    await savePinRecord(AGENT_PIN_TYPE, pinHash)
    await supabase
      .from('settings')
      .update({
        agent_pin_hash: pinHash,
        agent_pin: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id)
  }

  const owner = await loadOwnerPinRecord()
  if (owner?.id && owner.record.pin && !owner.record.hash) {
    await supabase
      .from('notifications')
      .update({
        message: JSON.stringify({
          hash: hashPin(owner.record.pin),
          updatedAt: new Date().toISOString(),
        } satisfies OwnerPinRecord),
        is_read: true,
      })
      .eq('id', owner.id)
  }

  const agent = await loadPinRecord(AGENT_PIN_TYPE)
  if (agent?.id && agent.record.pin && !agent.record.hash) {
    await supabase
      .from('notifications')
      .update({
        message: JSON.stringify({
          hash: hashPin(agent.record.pin),
          updatedAt: new Date().toISOString(),
        } satisfies AgentPinRecord),
        is_read: true,
      })
      .eq('id', agent.id)
  }

  const phat = await loadPinRecord(PHAT_PIN_TYPE)
  if (phat?.id && phat.record.pin && !phat.record.hash) {
    await supabase
      .from('notifications')
      .update({
        message: JSON.stringify({
          hash: hashPin(phat.record.pin),
          updatedAt: new Date().toISOString(),
        }),
        is_read: true,
      })
      .eq('id', phat.id)
  }
}
