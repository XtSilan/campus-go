import { createHash, randomBytes, scryptSync } from 'node:crypto'

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, storedValue) {
  const [salt, existingHash] = storedValue.split(':')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return hash === existingHash
}

export function createSessionToken() {
  return randomBytes(24).toString('hex')
}

export function makeAvatarColor(seed) {
  const palette = ['#b55a34', '#4f6a44', '#8d4324', '#94613b', '#6d5a47', '#a55d47']
  const digest = createHash('sha256').update(seed).digest()
  return palette[digest[0] % palette.length]
}

export function now() {
  return new Date().toISOString()
}

export function futureHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}
