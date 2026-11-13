// tests/integration/dataClient.test.ts
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FileBackend } from '@/lib/data/backend'
import { createDb } from '@/lib/data/client'
import { createTestDb, type TestDb } from '../helpers/db'

const jeune = (username: string) => ({ username, displayName: username, passwordHash: 'x', role: 'JEUNE' })

describe('client de données', () => {
  let t: TestDb
  beforeEach(async () => {
    t = await createTestDb()
  })
  afterEach(async () => {
    await t.cleanup()
  })

  it('annule toute une transaction quand elle échoue', async () => {
    await expect(
      t.prisma.$transaction(async (tx) => {
        await tx.user.create({ data: jeune('lucie') })
        await tx.project.create({ data: { title: 'Camp' } })
        throw new Error('boum')
      }),
    ).rejects.toThrow('boum')
    expect(await t.prisma.user.count()).toBe(0)
    expect(await t.prisma.project.count()).toBe(0)
  })

  it('lit ses propres écritures dans une transaction', async () => {
    const total = await t.prisma.$transaction(async (tx) => {
      await tx.user.create({ data: jeune('lucie') })
      await tx.user.create({ data: jeune('tom') })
      return tx.user.count()
    })
    expect(total).toBe(2)
  })

  it('refuse une valeur unique en double, avec le code Prisma P2002', async () => {
    await t.prisma.user.create({ data: jeune('lucie') })
    await expect(t.prisma.user.create({ data: jeune('lucie') })).rejects.toMatchObject({ code: 'P2002' })
    // La valeur se libère quand on renomme.
    await t.prisma.user.update({ where: { username: 'lucie' }, data: { username: 'lucie2' } })
    await t.prisma.user.create({ data: jeune('lucie') })
    expect(await t.prisma.user.count()).toBe(2)
  })

  it('détecte deux écritures concurrentes sur le même enregistrement', async () => {
    const user = await t.prisma.user.create({ data: jeune('lucie') })
    let entered!: () => void
    const inside = new Promise<void>((r) => (entered = r))
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))

    const lente = t.prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id: user.id } })
      entered()
      await gate
      await tx.user.update({ where: { id: user.id }, data: { displayName: `${u?.displayName} A` } })
    })
    await inside
    await t.prisma.user.update({ where: { id: user.id }, data: { displayName: 'B' } })
    release()

    await expect(lente).rejects.toMatchObject({ code: 'P2034' })
    expect((await t.prisma.user.findUnique({ where: { id: user.id } }))?.displayName).toBe('B')
  })

  it('supprime en cascade et vérifie les clés étrangères', async () => {
    const chef = await t.prisma.user.create({ data: { ...jeune('sarah'), role: 'CHEF' } })
    const projet = await t.prisma.project.create({ data: { title: 'Camp' } })
    await t.prisma.task.create({
      data: {
        projectId: projet.id,
        title: 'Budget',
        phase: 'CHOISIR',
        difficulty: 'FACILE',
        status: 'OUVERTE',
        createdById: chef.id,
        assignments: { create: [{ userId: chef.id }] },
      },
    })
    expect(await t.prisma.taskAssignment.count()).toBe(1)

    await t.prisma.project.delete({ where: { id: projet.id } })
    expect(await t.prisma.task.count()).toBe(0)
    expect(await t.prisma.taskAssignment.count()).toBe(0)

    await expect(
      t.prisma.taskAssignment.create({ data: { taskId: 'inexistante', userId: chef.id } }),
    ).rejects.toMatchObject({ code: 'P2003' })
  })

  it('filtre, trie et compte à travers les relations', async () => {
    const [a, b] = await Promise.all([
      t.prisma.user.create({ data: jeune('alice') }),
      t.prisma.user.create({ data: jeune('bob') }),
    ])
    const projet = await t.prisma.project.create({ data: { title: 'Camp', status: 'EN_COURS' } })
    for (const [u, amount] of [[a, 10], [a, 5], [b, 7]] as const) {
      await t.prisma.pointsEntry.create({ data: { userId: u.id, projectId: projet.id, amount, reason: 'BONUS' } })
    }

    const sommes = await t.prisma.pointsEntry.groupBy({ by: ['userId'], _sum: { amount: true } })
    expect(Object.fromEntries(sommes.map((s) => [s.userId, s._sum.amount]))).toEqual({ [a.id]: 15, [b.id]: 7 })

    const avecPoints = await t.prisma.user.findMany({
      where: { pointsEntries: { some: { amount: { gte: 10 } } } },
      select: { username: true, _count: { select: { pointsEntries: true } } },
    })
    expect(avecPoints).toEqual([{ username: 'alice', _count: { pointsEntries: 2 } }])

    const tries = await t.prisma.pointsEntry.findMany({
      orderBy: [{ user: { username: 'desc' } }, { amount: 'asc' }],
      select: { amount: true },
    })
    expect(tries.map((e) => e.amount)).toEqual([7, 5, 10])
  })
})

describe('magasin fichier', () => {
  it('garde les données d’un démarrage à l’autre', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cap-file-'))
    try {
      const file = join(dir, 'cap.json')
      const premier = createDb(new FileBackend(file))
      await premier.user.create({ data: jeune('lucie') })

      const second = createDb(new FileBackend(file))
      const lucie = await second.user.findUnique({ where: { username: 'lucie' } })
      expect(lucie?.createdAt).toBeInstanceOf(Date)
      await expect(second.user.create({ data: jeune('lucie') })).rejects.toMatchObject({ code: 'P2002' })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
