// tests/integration/tasks.test.ts
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { TaskTransitionError } from '@/lib/domain/tasks'
import type { Actor } from '@/lib/domain/types'
import { archiveProject, createProject } from '@/lib/services/projectService'
import { createTask, decideProposal, joinTask, leaveTask, listBoard, removeParticipant } from '@/lib/services/taskService'
import { createTestDb, type TestDb } from '../helpers/db'

describe('tâches', () => {
  let t: TestDb
  let chef: Actor
  let lucie: Actor
  let tom: Actor
  let projectId: string

  beforeEach(async () => {
    t = createTestDb()
    const mk = async (username: string, role: Actor['role']): Promise<Actor> => {
      const u = await t.prisma.user.create({ data: { username, displayName: username, passwordHash: 'x', role } })
      return { id: u.id, role, displayName: username }
    }
    chef = await mk('sarah', 'CHEF')
    lucie = await mk('lucie', 'JEUNE')
    tom = await mk('tom', 'JEUNE')
    projectId = (await createProject(t.prisma, chef, { title: 'Camp 2027' })).id
  })
  afterEach(async () => { await t.cleanup() })

  const nouvelleTache = (actor: Actor) =>
    createTask(t.prisma, actor, { projectId, title: 'Faire le budget', phase: 'AGIR', difficulty: 'MOYEN' })

  it('ouvre directement une tâche créée par un chef', async () => {
    expect((await nouvelleTache(chef)).status).toBe('OUVERTE')
  })

  it('met en attente une tâche proposée par un jeune et prévient les chefs', async () => {
    const task = await nouvelleTache(lucie)
    expect(task.status).toBe('PROPOSEE')
    expect(await t.prisma.notification.count({ where: { userId: chef.id, type: 'PROPOSITION' } })).toBe(1)
  })

  it('accepte une proposition et prévient son auteur', async () => {
    const task = await nouvelleTache(lucie)
    expect((await decideProposal(t.prisma, chef, task.id, true)).status).toBe('OUVERTE')
    expect(await t.prisma.notification.count({ where: { userId: lucie.id, type: 'PROPOSITION_ACCEPTEE' } })).toBe(1)
  })

  it('refuse qu un jeune accepte une proposition', async () => {
    const task = await nouvelleTache(lucie)
    await expect(decideProposal(t.prisma, tom, task.id, true)).rejects.toBeInstanceOf(TaskTransitionError)
  })

  it('inscrit un jeune et passe la tâche en cours', async () => {
    const task = await nouvelleTache(chef)
    const apres = await joinTask(t.prisma, lucie, task.id)
    expect(apres.status).toBe('EN_COURS')
    expect(await t.prisma.taskAssignment.count({ where: { taskId: task.id } })).toBe(1)
  })

  it('refuse une double inscription', async () => {
    const task = await nouvelleTache(chef)
    await joinTask(t.prisma, lucie, task.id)
    await expect(joinTask(t.prisma, lucie, task.id)).rejects.toBeInstanceOf(TaskTransitionError)
  })

  it('rouvre la tâche quand le dernier inscrit se retire', async () => {
    const task = await nouvelleTache(chef)
    await joinTask(t.prisma, lucie, task.id)
    await joinTask(t.prisma, tom, task.id)

    expect((await leaveTask(t.prisma, tom, task.id)).status).toBe('EN_COURS')
    expect((await leaveTask(t.prisma, lucie, task.id)).status).toBe('OUVERTE')
  })

  it('laisse un chef retirer un participant', async () => {
    const task = await nouvelleTache(chef)
    await joinTask(t.prisma, lucie, task.id)
    await removeParticipant(t.prisma, chef, task.id, lucie.id)
    expect(await t.prisma.taskAssignment.count({ where: { taskId: task.id } })).toBe(0)
  })

  it('refuse qu un jeune retire quelqu un d autre', async () => {
    const task = await nouvelleTache(chef)
    await joinTask(t.prisma, lucie, task.id)
    await expect(removeParticipant(t.prisma, tom, task.id, lucie.id)).rejects.toBeInstanceOf(TaskTransitionError)
  })

  it('interdit toute action sur un CAP archivé', async () => {
    const task = await nouvelleTache(chef)
    await archiveProject(t.prisma, chef, projectId)
    await expect(joinTask(t.prisma, lucie, task.id)).rejects.toBeInstanceOf(TaskTransitionError)
    await expect(createTask(t.prisma, chef, { projectId, title: 'Trop tard', phase: 'AGIR', difficulty: 'FACILE' }))
      .rejects.toThrow(/archivé/)
  })

  it('range le tableau par phase, sans les propositions en attente ni les rejetées', async () => {
    await createTask(t.prisma, chef, { projectId, title: 'A', phase: 'CHOISIR', difficulty: 'FACILE' })
    await createTask(t.prisma, chef, { projectId, title: 'B', phase: 'AGIR', difficulty: 'FACILE' })
    const proposee = await nouvelleTache(lucie)
    await decideProposal(t.prisma, chef, proposee.id, false)

    const board = await listBoard(t.prisma, projectId)
    expect(board.CHOISIR.map((task) => task.title)).toEqual(['A'])
    expect(board.AGIR.map((task) => task.title)).toEqual(['B'])
    expect(board.PARTAGER).toEqual([])
  })

  it('refuse une phase ou une difficulté hors nomenclature', async () => {
    await expect(
      createTask(t.prisma, chef, { projectId, title: 'Bidon', phase: 'FOO' as never, difficulty: 'MOYEN' }),
    ).rejects.toThrow(/phase/i)

    await expect(
      createTask(t.prisma, chef, { projectId, title: 'Bidon', phase: 'AGIR', difficulty: 'ENORME' as never }),
    ).rejects.toThrow(/difficult/i)
  })

  it('ne casse pas le tableau si une phase inconnue traîne en base', async () => {
    await t.prisma.task.create({
      data: { projectId, title: 'Vieille tâche', phase: 'FOO', difficulty: 'MOYEN', status: 'OUVERTE', createdById: chef.id },
    })

    const board = await listBoard(t.prisma, projectId)
    expect(Object.keys(board)).toEqual(['CHOISIR', 'AGIR', 'PARTAGER'])
  })
})
