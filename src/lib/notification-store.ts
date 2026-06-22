type NotificationInsertPayload = {
  type: string
  message: string
  pawn_id?: string | null
  action_url?: string | null
  is_read?: boolean
}

type NotificationRow = {
  id: string
  type: string
  message: string
  pawn_id?: string | null
  action_url?: string | null
  created_at: string
}

function isMissingActionUrlError(error: unknown) {
  const message = error && typeof error === 'object' && 'message' in error ? String((error as { message?: string }).message || '') : ''
  return message.includes('action_url') && (message.includes('schema cache') || message.includes('column'))
}

export async function insertNotificationRecord(
  supabase: any,
  payload: NotificationInsertPayload,
) {
  const firstAttempt = await supabase.from('notifications').insert(payload)
  if (!firstAttempt.error || !payload.action_url || !isMissingActionUrlError(firstAttempt.error)) {
    return firstAttempt
  }

  const { action_url: _ignored, ...fallbackPayload } = payload
  return supabase.from('notifications').insert(fallbackPayload)
}

export async function selectNotificationRows(
  supabase: any,
  limit = 60,
) {
  const primary = await supabase
    .from('notifications')
    .select('id,type,message,pawn_id,action_url,created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!primary.error || !isMissingActionUrlError(primary.error)) {
    return primary as { data: NotificationRow[] | null; error: any }
  }

  const fallback = await supabase
    .from('notifications')
    .select('id,type,message,pawn_id,created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  return {
    data: ((fallback.data || []) as Array<Omit<NotificationRow, 'action_url'> | NotificationRow>).map((row) => ({
      ...row,
      action_url: null,
    })) as NotificationRow[],
    error: fallback.error,
  }
}
