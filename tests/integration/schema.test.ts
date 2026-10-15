// tests/integration/schema.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from '../helpers/db'

describe('schéma', () => {
  let t: TestDb
  beforeAll(() => { t = createTestDb() })
  afterAll(async () => { await t.cleanup() })

  it('crée un jeune et refuse un identifiant en doublon', async () => {
    await t.prisma.user.create({
      data: { username: 'lucie', displayName: 'Lucie', passwordHash: 'x', role: 'JEUNE' },
    })

    await expect(
      t.prisma.user.create({
        data: { username: 'lucie', displayName: 'Lucie B', passwordHash: 'x', role: 'JEUNE' },
      }),
    ).rejects.toThrow()
  })

  it('refuse deux lignes de points pour la même soumission et le même jeune', async () => {
    const user = await t.prisma.user.create({
      data: { username: 'tom', displayName: 'Tom', passwordHash: 'x', role: 'JEUNE' },
    })
    const project = await t.prisma.project.create({ data: { title: 'Camp 2027' } })
    const base = { userId: user.id, projectId: project.id, amount: 10, reason: 'TACHE', submissionId: 'sub-1' }

    await t.prisma.pointsEntry.create({ data: base })
    await expect(t.prisma.pointsEntry.create({ data: base })).rejects.toThrow()
  })
})
