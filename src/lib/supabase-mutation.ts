type SupabaseLikeResult = {
  error?: {
    message?: string | null
  } | null
}

export function assertSupabaseMutation(result: SupabaseLikeResult, fallbackMessage = 'Database operation failed') {
  if (result.error) {
    throw new Error(result.error.message || fallbackMessage)
  }
}
