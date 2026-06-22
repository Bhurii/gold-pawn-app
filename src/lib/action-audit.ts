export type ActionAuditParentType = 'pawn' | 'loan'
export type ActionAuditEntityType = 'interest_payment' | 'loan_transaction'
export type ActionAuditEventType = 'update' | 'delete'

export type ActionAuditRow = {
  id: string
  entity_type: ActionAuditEntityType
  entity_id: string
  parent_type: ActionAuditParentType
  parent_id: string
  event_type: ActionAuditEventType
  actor_user_key: string
  actor_display_name: string
  remark: string | null
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  created_at: string
}

type InsertAuditPayload = Omit<ActionAuditRow, 'id' | 'created_at'>

function isMissingAuditTableError(error: unknown) {
  const message = error && typeof error === 'object' && 'message' in error ? String((error as { message?: string }).message || '') : ''
  return message.includes('action_audits') && (message.includes('schema cache') || message.includes('column') || message.includes('relation'))
}

export async function insertActionAudit(
  supabase: any,
  payload: InsertAuditPayload,
) {
  const result = await supabase.from('action_audits').insert(payload)
  if (result.error && isMissingAuditTableError(result.error)) {
    return { error: null }
  }
  return result
}

export async function selectActionAudits(
  supabase: any,
  parentType: ActionAuditParentType,
  parentId: string,
) {
  const result = await supabase
    .from('action_audits')
    .select('id, entity_type, entity_id, parent_type, parent_id, event_type, actor_user_key, actor_display_name, remark, before_data, after_data, created_at')
    .eq('parent_type', parentType)
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false })

  if (result.error && isMissingAuditTableError(result.error)) {
    return { data: [] as ActionAuditRow[], error: null }
  }

  return result as { data: ActionAuditRow[] | null; error: any }
}
