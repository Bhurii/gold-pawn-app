import { createAdminClient } from '@/lib/server/admin'
import { hashPin, isHashedPin, verifyPin } from '@/lib/server/pin'

const OWNER_PIN_TYPE = 'owner_pin_config'

type OwnerPinRecord = {
  hash?: string
  pin?: string
  updatedAt: string
}

async function readSettingsRow() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('settings')
    .select('id, invest_budget, agent_pin, agent_pin_hash')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data || null
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
  const settings = await ensureSettingsRow()
  return {
    id: settings.id,
    invest_budget: Number(settings.invest_budget || 0),
    hasAgentPin: Boolean(settings.agent_pin_hash || settings.agent_pin),
  }
}

export async function saveBudget(investBudget: number) {
  const supabase = createAdminClient()
  const settings = await ensureSettingsRow()
  const { error } = await supabase
    .from('settings')
    .update({ invest_budget: investBudget, updated_at: new Date().toISOString() })
    .eq('id', settings.id)

  if (error) throw error
}

export async function saveAgentPin(pin: string) {
  const supabase = createAdminClient()
  const settings = await ensureSettingsRow()
  const pinHash = hashPin(pin)

  const { error } = await supabase
    .from('settings')
    .update({
      agent_pin: null,
      agent_pin_hash: pinHash,
      updated_at: new Date().toISOString(),
    })
    .eq('id', settings.id)

  if (error) throw error
}

export async function verifyAgentPin(pin: string) {
  const settings = await readSettingsRow()
  if (!settings) return false
  return verifyPin(settings.agent_pin_hash || settings.agent_pin, pin)
}

async function loadOwnerPinRecord() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('notifications')
    .select('id, message')
    .eq('type', OWNER_PIN_TYPE)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.message) return null

  try {
    return {
      id: data.id,
      record: JSON.parse(data.message) as OwnerPinRecord,
    }
  } catch {
    return null
  }
}

export async function hasOwnerPinRecord() {
  const current = await loadOwnerPinRecord()
  return Boolean(current?.record?.hash || current?.record?.pin)
}

export async function saveOwnerPin(pin: string) {
  const supabase = createAdminClient()
  const payload: OwnerPinRecord = {
    hash: hashPin(pin),
    updatedAt: new Date().toISOString(),
  }
  const current = await loadOwnerPinRecord()

  if (current?.id) {
    const { error } = await supabase
      .from('notifications')
      .update({ message: JSON.stringify(payload), is_read: true })
      .eq('id', current.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('notifications').insert({
    type: OWNER_PIN_TYPE,
    message: JSON.stringify(payload),
    is_read: true,
  })
  if (error) throw error
}

export async function verifyOwnerPin(pin: string) {
  const current = await loadOwnerPinRecord()
  const stored = current?.record?.hash || current?.record?.pin
  return verifyPin(stored, pin)
}

export async function maybeUpgradeLegacyPins() {
  const supabase = createAdminClient()
  const settings = await ensureSettingsRow()

  if (settings.agent_pin && !isHashedPin(settings.agent_pin_hash)) {
    await supabase
      .from('settings')
      .update({
        agent_pin_hash: hashPin(settings.agent_pin),
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
}
