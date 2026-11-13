// tests/integration/users.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loginThrottle } from '@/lib/auth/throttle'
import type { Actor } from '@/lib/domain/types'
import {
  AuthError,
  authenticate,
  changeOwnPassword,
  createUser,
  listMembers,
  resetPassword,
  setActive,
} from '@/lib/services/userService'
import { createTestDb, type TestDb } from '../helpers/db'

describe('comptes', () => {
  let t: TestDb
  let admin: Actor
  let chef: Actor

  beforeEach(async () => {
    t = await createTestDb()
    const u = await t.prisma.user.create({
      data: { username: 'admin', displayName: 'Admin', passwordHash: 'x', role: 'SUPER_ADMIN' },
    })
    admin = { id: u.id, role: 'SUPER_ADMIN', displayName: 'Admin' }
    const c = await t.prisma.user.create({
      data: { username: 'sarah', displayName: 'Sarah', passwordHash: 'x', role: 'CHEF' },
    })
    chef = { id: c.id, role: 'CHEF', displayName: 'Sarah' }
    loginThrottle.reset('lucie')
  })
  afterEach(async () => { await t.cleanup() })

  it('crée un jeune avec un mot de passe provisoire à changer', async () => {
    const { user, tempPassword } = await createUser(t.prisma, admin, {
      username: 'Lucie', displayName: 'Lucie M.', role: 'JEUNE',
    })
    expect(user.username).toBe('lucie')
    expect(user.mustChangePassword).toBe(true)
    expect(tempPassword.length).toBeGreaterThanOrEqual(10)
    expect(user.passwordHash).not.toContain(tempPassword)
  })

  // Review Focus 5
  it('refuse un identifiant déjà pris, même avec une autre casse', async () => {
    await createUser(t.prisma, admin, { username: 'lucie', displayName: 'Lucie', role: 'JEUNE' })
    await expect(createUser(t.prisma, admin, { username: 'LUCIE', displayName: 'Lucie B.', role: 'JEUNE' }))
      .rejects.toThrow(/identifiant/i)
  })

  it('refuse un identifiant vide ou avec des espaces', async () => {
    await expect(createUser(t.prisma, admin, { username: '  ', displayName: 'X', role: 'JEUNE' })).rejects.toThrow()
    await expect(createUser(t.prisma, admin, { username: 'a b', displayName: 'X', role: 'JEUNE' })).rejects.toThrow()
  })

  it('réserve la création de comptes au super admin', async () => {
    await expect(createUser(t.prisma, chef, { username: 'tom', displayName: 'Tom', role: 'JEUNE' }))
      .rejects.toThrow()
  })

  it('connecte avec le bon mot de passe, quelle que soit la casse de l identifiant', async () => {
    const { tempPassword } = await createUser(t.prisma, admin, { username: 'lucie', displayName: 'Lucie', role: 'JEUNE' })
    const session = await authenticate(t.prisma, 'LUCIE', tempPassword)
    expect(session).toMatchObject({ displayName: 'Lucie', role: 'JEUNE', mustChangePassword: true })
  })

  it('refuse un mauvais mot de passe et un compte inconnu, avec le même message', async () => {
    const { tempPassword } = await createUser(t.prisma, admin, { username: 'lucie', displayName: 'Lucie', role: 'JEUNE' })
    await expect(authenticate(t.prisma, 'lucie', 'faux')).rejects.toBeInstanceOf(AuthError)
    await expect(authenticate(t.prisma, 'inconnu', tempPassword)).rejects.toThrow('Identifiant ou mot de passe incorrect.')
  })

  it('refuse la connexion d un compte désactivé', async () => {
    const { user, tempPassword } = await createUser(t.prisma, admin, { username: 'lucie', displayName: 'Lucie', role: 'JEUNE' })
    await setActive(t.prisma, admin, user.id, false)
    await expect(authenticate(t.prisma, 'lucie', tempPassword)).rejects.toBeInstanceOf(AuthError)
  })

  it('bloque après trop d échecs puis débloque après une réussite', async () => {
    const { tempPassword } = await createUser(t.prisma, admin, { username: 'lucie', displayName: 'Lucie', role: 'JEUNE' })
    for (let i = 0; i < 10; i += 1) {
      await expect(authenticate(t.prisma, 'lucie', 'faux')).rejects.toThrow()
    }
    await expect(authenticate(t.prisma, 'lucie', tempPassword)).rejects.toThrow(/trop de tentatives/i)

    loginThrottle.reset('lucie')
    await expect(authenticate(t.prisma, 'lucie', tempPassword)).resolves.toBeTruthy()
  })

  it('change son mot de passe et lève le drapeau', async () => {
    const { user, tempPassword } = await createUser(t.prisma, admin, { username: 'lucie', displayName: 'Lucie', role: 'JEUNE' })
    const lucie: Actor = { id: user.id, role: 'JEUNE', displayName: 'Lucie' }

    await expect(changeOwnPassword(t.prisma, lucie, 'mauvais', 'nouveaumdp1')).rejects.toThrow()
    await expect(changeOwnPassword(t.prisma, lucie, tempPassword, 'court')).rejects.toThrow(/8 caractères/)

    await changeOwnPassword(t.prisma, lucie, tempPassword, 'nouveaumdp1')
    const apres = await authenticate(t.prisma, 'lucie', 'nouveaumdp1')
    expect(apres.mustChangePassword).toBe(false)
  })

  it('laisse un chef réinitialiser le mot de passe d un jeune et coupe ses sessions', async () => {
    const { user } = await createUser(t.prisma, admin, { username: 'lucie', displayName: 'Lucie', role: 'JEUNE' })
    await t.prisma.session.create({
      data: { id: 'session-test', userId: user.id, expiresAt: new Date(Date.now() + 100_000) },
    })

    const nouveau = await resetPassword(t.prisma, chef, user.id)

    expect(await t.prisma.session.count({ where: { userId: user.id } })).toBe(0)
    const session = await authenticate(t.prisma, 'lucie', nouveau)
    expect(session.mustChangePassword).toBe(true)
  })

  it('interdit à un chef de réinitialiser le mot de passe d un autre chef', async () => {
    const autre = await t.prisma.user.create({
      data: { username: 'marc', displayName: 'Marc', passwordHash: 'x', role: 'CHEF' },
    })
    await expect(resetPassword(t.prisma, chef, autre.id)).rejects.toThrow()
    await expect(resetPassword(t.prisma, admin, autre.id)).resolves.toBeTruthy()
  })

  it('liste les membres actifs et désactivés, jeunes d abord', async () => {
    await createUser(t.prisma, admin, { username: 'lucie', displayName: 'Lucie', role: 'JEUNE' })
    const membres = await listMembers(t.prisma)
    expect(membres.map((m) => m.displayName)).toEqual(['Lucie', 'Admin', 'Sarah'])
  })
})
