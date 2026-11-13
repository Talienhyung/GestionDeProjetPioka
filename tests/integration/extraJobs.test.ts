import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Actor } from '@/lib/domain/types'
import { parseEuros } from '@/lib/domain/money'
import {
  createExtraJob,
  deleteExtraJob,
  listExtraJobs,
  totalCollected,
  totalForProject,
} from '@/lib/services/extraJobService'
import { archiveProject, createProject, launchProject } from '@/lib/services/projectService'
import { createTestDb, type TestDb } from '../helpers/db'

describe('extra jobs', () => {
  let t: TestDb
  let chef: Actor
  let lucie: Actor
  let tom: Actor
  let capA: string
  let capB: string
  const doneOn = new Date('2026-11-01')

  beforeEach(async () => {
    t = await createTestDb()
    const mk = async (username: string, role: Actor['role']): Promise<Actor> => {
      const u = await t.prisma.user.create({ data: { username, displayName: username, passwordHash: 'x', role } })
      return { id: u.id, role, displayName: username }
    }
    chef = await mk('sarah', 'CHEF')
    lucie = await mk('lucie', 'JEUNE')
    tom = await mk('tom', 'JEUNE')
    capA = (await createProject(t.prisma, chef, { title: 'Cap A' })).id
    capB = (await createProject(t.prisma, chef, { title: 'Cap B' })).id
    await launchProject(t.prisma, chef, capA)
    await launchProject(t.prisma, chef, capB)
  })
  afterEach(async () => { await t.cleanup() })

  it('répartit un extra job fait à plusieurs entre plusieurs CAP', async () => {
    await createExtraJob(t.prisma, chef, {
      title: 'Lavage de voitures',
      doneOn,
      workerIds: [lucie.id, tom.id],
      shares: [{ projectId: capA, amountCents: 500 }, { projectId: capB, amountCents: 1500 }],
    })

    const [job] = await listExtraJobs(t.prisma)
    expect(job.title).toBe('Lavage de voitures')
    expect(job.workers.map((w) => w.user.displayName).sort()).toEqual(['lucie', 'tom'])
    expect(await totalForProject(t.prisma, capA)).toBe(500)
    expect(await totalForProject(t.prisma, capB)).toBe(1500)
    expect(await totalCollected(t.prisma, lucie)).toBe(2000)
  })

  it('n’additionne pas les CAP archivés ni, pour un jeune, les brouillons', async () => {
    const brouillon = (await createProject(t.prisma, chef, { title: 'Secret' })).id
    await createExtraJob(t.prisma, chef, {
      title: 'Babysitting', doneOn, workerIds: [lucie.id],
      shares: [
        { projectId: capA, amountCents: 1000 },
        { projectId: capB, amountCents: 300 },
        { projectId: brouillon, amountCents: 200 },
      ],
    })
    await archiveProject(t.prisma, chef, capB)

    expect(await totalCollected(t.prisma, lucie)).toBe(1000)
    expect(await totalCollected(t.prisma, chef)).toBe(1200)
    // Sur la page du CAP archivé, son montant reste consultable.
    expect(await totalForProject(t.prisma, capB)).toBe(300)
  })

  it('réserve la saisie et la suppression aux chefs', async () => {
    const input = { title: 'Jardin', doneOn, workerIds: [tom.id], shares: [{ projectId: capA, amountCents: 100 }] }
    await expect(createExtraJob(t.prisma, lucie, input)).rejects.toThrow()

    const job = await createExtraJob(t.prisma, chef, input)
    await expect(deleteExtraJob(t.prisma, tom, job.id)).rejects.toThrow()
    await deleteExtraJob(t.prisma, chef, job.id)
    expect(await totalForProject(t.prisma, capA)).toBe(0)
  })

  it('refuse une saisie incomplète ou incohérente', async () => {
    const ok = { title: 'Jardin', doneOn, workerIds: [tom.id], shares: [{ projectId: capA, amountCents: 100 }] }

    await expect(createExtraJob(t.prisma, chef, { ...ok, title: '  ' })).rejects.toThrow(/titre|quoi/i)
    await expect(createExtraJob(t.prisma, chef, { ...ok, workerIds: [] })).rejects.toThrow(/jeune/i)
    await expect(createExtraJob(t.prisma, chef, { ...ok, workerIds: [chef.id] })).rejects.toThrow(/jeune/i)
    await expect(createExtraJob(t.prisma, chef, { ...ok, shares: [] })).rejects.toThrow(/CAP/)
    await expect(createExtraJob(t.prisma, chef, { ...ok, shares: [{ projectId: capA, amountCents: 0 }] }))
      .rejects.toThrow(/montant/i)
    await expect(createExtraJob(t.prisma, chef, {
      ...ok, shares: [{ projectId: capA, amountCents: 100 }, { projectId: capA, amountCents: 50 }],
    })).rejects.toThrow(/deux fois/i)

    await archiveProject(t.prisma, chef, capB)
    await expect(createExtraJob(t.prisma, chef, { ...ok, shares: [{ projectId: capB, amountCents: 100 }] }))
      .rejects.toThrow(/archivé/i)
    expect(await listExtraJobs(t.prisma)).toEqual([])
  })
})

describe('parseEuros', () => {
  it('lit les montants saisis à la française', () => {
    expect(parseEuros('20')).toBe(2000)
    expect(parseEuros('5,50')).toBe(550)
    expect(parseEuros(' 12.3 ')).toBe(1230)
    expect(parseEuros('')).toBeNull()
    expect(parseEuros('abc')).toBeNull()
    expect(parseEuros('1,234')).toBeNull()
    expect(parseEuros('-3')).toBeNull()
  })
})
