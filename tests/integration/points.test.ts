// tests/integration/points.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DuplicateAwardError, creditPoints, getLeaderboard, getLedger, getScore } from '@/lib/services/pointsService'
import { countUnread, listNotifications, markAllRead, notify } from '@/lib/services/notificationService'
import { createTestDb, type TestDb } from '../helpers/db'

describe('grand livre des points', () => {
  let t: TestDb
  let lucie: string
  let tom: string
  let projectId: string

  beforeAll(async () => {
    t = createTestDb()
    lucie = (await t.prisma.user.create({ data: { username: 'lucie', displayName: 'Lucie', passwordHash: 'x', role: 'JEUNE' } })).id
    tom = (await t.prisma.user.create({ data: { username: 'tom', displayName: 'Tom', passwordHash: 'x', role: 'JEUNE' } })).id
    projectId = (await t.prisma.project.create({ data: { title: 'Camp 2027' } })).id
  })
  afterAll(async () => { await t.cleanup() })

  it('additionne les lignes, y compris négatives', async () => {
    await creditPoints(t.prisma, { userId: lucie, projectId, amount: 25, reason: 'TACHE' })
    await creditPoints(t.prisma, { userId: lucie, projectId, amount: 5, reason: 'BONUS' })
    await creditPoints(t.prisma, { userId: lucie, projectId, amount: -10, reason: 'ANNULATION' })
    expect(await getScore(t.prisma, lucie)).toBe(20)
  })

  it('rend 0 pour un jeune sans aucune ligne', async () => {
    expect(await getScore(t.prisma, tom)).toBe(0)
  })

  // Review Focus 1
  it('refuse deux crédits pour la même soumission', async () => {
    const input = { userId: tom, projectId, amount: 25, reason: 'TACHE' as const, submissionId: 'sub-42' }
    await creditPoints(t.prisma, input)
    await expect(creditPoints(t.prisma, input)).rejects.toBeInstanceOf(DuplicateAwardError)
    expect(await getScore(t.prisma, tom)).toBe(25)
  })

  it('autorise plusieurs jeunes sur la même soumission', async () => {
    await creditPoints(t.prisma, { userId: lucie, projectId, amount: 13, reason: 'TACHE', submissionId: 'sub-99' })
    await creditPoints(t.prisma, { userId: tom, projectId, amount: 13, reason: 'TACHE', submissionId: 'sub-99' })
    expect(await getScore(t.prisma, tom)).toBe(38)
  })

  it('rend le détail du score, du plus récent au plus ancien', async () => {
    const lignes = await getLedger(t.prisma, lucie)
    expect(lignes.length).toBeGreaterThan(0)
    expect(lignes[0].createdAt.getTime()).toBeGreaterThanOrEqual(lignes[lignes.length - 1].createdAt.getTime())
  })

  it('classe les jeunes par score décroissant', async () => {
    const classement = await getLeaderboard(t.prisma, projectId)
    expect(classement.map((r) => r.displayName)).toEqual(['Tom', 'Lucie'])
    expect(classement[0].points).toBe(38)
  })

  it('ne compte que le projet demandé', async () => {
    const autre = await t.prisma.project.create({ data: { title: 'Projet 2028' } })
    await creditPoints(t.prisma, { userId: lucie, projectId: autre.id, amount: 100, reason: 'TACHE' })
    expect(await getScore(t.prisma, lucie, projectId)).toBe(33)
    expect(await getScore(t.prisma, lucie)).toBe(133)
  })
})

describe('notifications', () => {
  let t: TestDb
  let userId: string

  beforeAll(async () => {
    t = createTestDb()
    userId = (await t.prisma.user.create({ data: { username: 'lucie', displayName: 'Lucie', passwordHash: 'x', role: 'JEUNE' } })).id
  })
  afterAll(async () => { await t.cleanup() })

  it('compte les non lues et les marque toutes lues', async () => {
    await notify(t.prisma, userId, { type: 'TACHE_VALIDEE', message: 'Bravo !', link: '/cap/1' })
    await notify(t.prisma, userId, { type: 'BADGE', message: 'Nouveau badge', link: '/profil' })
    expect(await countUnread(t.prisma, userId)).toBe(2)

    await markAllRead(t.prisma, userId)
    expect(await countUnread(t.prisma, userId)).toBe(0)
    expect((await listNotifications(t.prisma, userId)).length).toBe(2)
  })
})
