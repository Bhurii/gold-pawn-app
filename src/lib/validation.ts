export function parsePositiveMoney(value: string, label = 'amount'): number {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${label} must be greater than 0`)
  }
  return amount
}

export function parseNonNegativeMoney(value: string, label = 'amount'): number {
  if (!value) return 0
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${label} must be 0 or greater`)
  }
  return amount
}

export function requireDate(value: string, label = 'date'): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} is required`)
  }
  return value
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error'
}
