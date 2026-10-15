import type { Db } from '@/lib/db'
import { assertPasswordAcceptable, generateTempPassword, hashPassword, verifyPassword } from '@/lib/auth/password'
import { destroyUserSessions } from '@/lib/auth/session'
import { loginThrottle } from '@/lib/auth/throttle'
import type { Actor, AppRole } from '@/lib/domain/types'
import { ForbiddenError, NotFoundError, ValidationError } from './errors'

export interface CreateUserInput {
  username: string
  displayName: string
  role: AppRole
}

export interface AuthenticatedUser extends Actor {
  mustChangePassword: boolean
}

export class AuthError extends Error {
  constructor(message = 'Identifiant ou mot de passe incorrect.') {
    super(message)
    this.name = 'AuthError'
  }
}

/** Les identifiants sont stockés en minuscules : l'unicité et la connexion ignorent la casse. */
function normalize(username: string): string {
  return username.trim().toLowerCase()
}

export async function createUser(db: Db, actor: Actor, input: CreateUserInput) {
  if (actor.role !== 'SUPER_ADMIN') throw new ForbiddenError('Seul le super admin peut créer des comptes.')

  const username = normalize(input.username)
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    throw new ValidationError(
      'L\'identifiant doit faire 3 à 30 caractères, sans espace ni accent (lettres, chiffres, point, tiret).',
    )
  }
  if (!input.displayName.trim()) throw new ValidationError('Le nom affiché est obligatoire.')

  if (await db.user.findUnique({ where: { username } })) {
    throw new ValidationError(`L'identifiant « ${username} » est déjà pris.`)
  }

  const tempPassword = generateTempPassword()
  const user = await db.user.create({
    data: {
      username,
      displayName: input.displayName.trim(),
      role: input.role,
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
    },
  })

  return { user, tempPassword }
}

export async function authenticate(db: Db, username: string, password: string): Promise<AuthenticatedUser> {
  const key = normalize(username)
  if (loginThrottle.isBlocked(key)) {
    throw new AuthError('Trop de tentatives. Réessaie dans un quart d\'heure ou préviens un chef.')
  }

  const user = await db.user.findUnique({ where: { username: key } })
  const ok = user?.isActive === true && (await verifyPassword(user.passwordHash, password))

  if (!ok || !user) {
    loginThrottle.registerFailure(key)
    throw new AuthError()
  }

  loginThrottle.reset(key)
  return {
    id: user.id,
    role: user.role as AppRole,
    displayName: user.displayName,
    mustChangePassword: user.mustChangePassword,
  }
}

export async function changeOwnPassword(db: Db, actor: Actor, current: string, next: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: actor.id } })
  if (!user) throw new NotFoundError('Compte')
  if (!(await verifyPassword(user.passwordHash, current))) {
    throw new ValidationError('Le mot de passe actuel est incorrect.')
  }
  assertPasswordAcceptable(next)

  await db.user.update({
    where: { id: actor.id },
    data: { passwordHash: await hashPassword(next), mustChangePassword: false },
  })
}

/** Un chef réinitialise le mot de passe d'un jeune ; le super admin, celui de n'importe qui. */
export async function resetPassword(db: Db, actor: Actor, userId: string): Promise<string> {
  const target = await db.user.findUnique({ where: { id: userId } })
  if (!target) throw new NotFoundError('Compte')

  const allowed = actor.role === 'SUPER_ADMIN' || (actor.role === 'CHEF' && target.role === 'JEUNE')
  if (!allowed) throw new ForbiddenError('Tu ne peux réinitialiser que le mot de passe d\'un jeune.')

  const tempPassword = generateTempPassword()
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
  })
  // L'ancien mot de passe ne doit plus donner accès à rien.
  await destroyUserSessions(db, userId)

  return tempPassword
}

export async function setActive(db: Db, actor: Actor, userId: string, active: boolean): Promise<void> {
  if (actor.role !== 'SUPER_ADMIN') throw new ForbiddenError('Seul le super admin peut activer ou désactiver un compte.')
  if (userId === actor.id) throw new ValidationError('Tu ne peux pas désactiver ton propre compte.')

  await db.user.update({ where: { id: userId }, data: { isActive: active } })
  if (!active) await destroyUserSessions(db, userId)
}

const ROLE_ORDER: Record<AppRole, number> = { JEUNE: 0, SUPER_ADMIN: 1, CHEF: 2 }

export async function listMembers(db: Db) {
  const users = await db.user.findMany({
    select: { id: true, username: true, displayName: true, role: true, isActive: true, mustChangePassword: true },
  })
  return users.sort(
    (a, b) =>
      ROLE_ORDER[a.role as AppRole] - ROLE_ORDER[b.role as AppRole] ||
      a.displayName.localeCompare(b.displayName, 'fr'),
  )
}
