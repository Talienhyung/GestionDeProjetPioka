import { createHash, randomBytes } from 'node:crypto'
import type { Db } from '@/lib/db'
import type { Actor, AppRole } from '@/lib/domain/types'

export const SESSION_COOKIE = 'cap_session'
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
/** En deçà de ce reste, la session est prolongée à la lecture (fenêtre glissante). */
const RENEW_BELOW_MS = 25 * 24 * 60 * 60 * 1000

export interface SessionUser extends Actor {
  mustChangePassword: boolean
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(db: Db, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt } })
  return { token, expiresAt }
}

export async function readSession(db: Db, token: string): Promise<SessionUser | null> {
  if (!token) return null
  const id = hashToken(token)
  const session = await db.session.findUnique({ where: { id }, include: { user: true } })
  if (!session) return null

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id } }).catch(() => undefined)
    return null
  }

  // Un compte désactivé perd l'accès à la seconde, sans attendre l'expiration.
  if (!session.user.isActive) return null

  if (session.expiresAt.getTime() - Date.now() < RENEW_BELOW_MS) {
    await db.session.update({ where: { id }, data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) } })
  }

  return {
    id: session.user.id,
    role: session.user.role as AppRole,
    displayName: session.user.displayName,
    mustChangePassword: session.user.mustChangePassword,
  }
}

export async function destroySession(db: Db, token: string): Promise<void> {
  await db.session.delete({ where: { id: hashToken(token) } }).catch(() => undefined)
}

export async function destroyUserSessions(db: Db, userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } })
}
