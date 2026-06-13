import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const PIN_PREFIX = 's1'

export function hashPin(pin: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(pin, salt, 32).toString('hex')
  return `${PIN_PREFIX}:${salt}:${hash}`
}

export function verifyPin(stored: string | null | undefined, pin: string) {
  if (!stored) return false

  const parts = stored.split(':')
  if (parts.length === 3 && parts[0] === PIN_PREFIX) {
    const [, salt, expectedHash] = parts
    const actualHash = scryptSync(pin, salt, 32).toString('hex')
    return timingSafeEqual(Buffer.from(actualHash, 'hex'), Buffer.from(expectedHash, 'hex'))
  }

  return stored === pin
}

export function isHashedPin(value: string | null | undefined) {
  return Boolean(value?.startsWith(`${PIN_PREFIX}:`))
}
