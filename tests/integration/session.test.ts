// tests/integration/session.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createSession, destroySession, destroyUserSessions, readSession } from '@/lib/auth/session'
import { createTestDb, type TestDb } from '../helpers/db'

describe('sessions', () => {
  let t: TestDb
  let userId: string

  beforeAll(async () => {
    t = await createTestDb()
    const user = await t.prisma.user.create({
      data: { username: 'lucie', displayName: 'Lucie', passwordHash: 'x', role: 'JEUNE', mustChangePassword: false },
    })
    userId = user.id
  })
  afterAll(async () => { await t.cleanup() })

  it('crée une session lisible et rend l acteur', async () => {
    const { token } = await createSession(t.prisma, userId)
    const session = await readSession(t.prisma, token)
    expect(session).toMatchObject({ id: userId, role: 'JEUNE', displayName: 'Lucie', mustChangePassword: false })
  })

  it('ne stocke jamais le jeton en clair', async () => {
    const { token } = await createSession(t.prisma, userId)
    expect(await t.prisma.session.findUnique({ where: { id: token } })).toBeNull()
  })

  it('rend null sur un jeton inconnu', async () => {
    expect(await readSession(t.prisma, 'jeton-inventé')).toBeNull()
  })

  it('rend null et supprime la session expirée', async () => {
    const { token } = await createSession(t.prisma, userId)
    const { id } = { id: (await t.prisma.session.findFirst({ orderBy: { createdAt: 'desc' } }))!.id }
    await t.prisma.session.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1_000) } })

    expect(await readSession(t.prisma, token)).toBeNull()
    expect(await t.prisma.session.findUnique({ where: { id } })).toBeNull()
  })

  // Review Focus 2
  it('refuse immédiatement la session d un compte désactivé', async () => {
    const { token } = await createSession(t.prisma, userId)
    await t.prisma.user.update({ where: { id: userId }, data: { isActive: false } })

    expect(await readSession(t.prisma, token)).toBeNull()

    await t.prisma.user.update({ where: { id: userId }, data: { isActive: true } })
  })

  it('prolonge une session qui approche de son terme', async () => {
    const { token } = await createSession(t.prisma, userId)
    const before = (await t.prisma.session.findFirst({ orderBy: { createdAt: 'desc' } }))!
    await t.prisma.session.update({
      where: { id: before.id },
      data: { expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    })

    await readSession(t.prisma, token)

    const after = (await t.prisma.session.findUnique({ where: { id: before.id } }))!
    expect(after.expiresAt.getTime()).toBeGreaterThan(Date.now() + 20 * 24 * 60 * 60 * 1000)
  })

  it('détruit une session, et toutes celles d un jeune', async () => {
    const a = await createSession(t.prisma, userId)
    await destroySession(t.prisma, a.token)
    expect(await readSession(t.prisma, a.token)).toBeNull()

    const b = await createSession(t.prisma, userId)
    const c = await createSession(t.prisma, userId)
    await destroyUserSessions(t.prisma, userId)
    expect(await readSession(t.prisma, b.token)).toBeNull()
    expect(await readSession(t.prisma, c.token)).toBeNull()
  })
})
