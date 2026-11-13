import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Actor } from '@/lib/domain/types'
import { createTestDb, type TestDb } from '../helpers/db'

let t: TestDb
let chef: Actor
let lucie: Actor
let currentUser: Actor

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/guard', () => ({
  requireUser: async () => currentUser,
  requireChef: async () => {
    if (currentUser.role === 'JEUNE') throw new Error('REDIRECT')
    return currentUser
  },
}))
vi.mock('@/lib/db', () => ({ get db() { return t.prisma } }))

describe('actions sur une tâche', () => {
  beforeEach(async () => {
    t = await createTestDb()
    const mk = async (username: string, role: Actor['role']): Promise<Actor> => {
      const u = await t.prisma.user.create({ data: { username, displayName: username, passwordHash: 'x', role } })
      return { id: u.id, role, displayName: username }
    }
    chef = await mk('sarah', 'CHEF')
    lucie = await mk('lucie', 'JEUNE')
    currentUser = chef
  })
  afterEach(async () => { await t.cleanup() })

  async function tacheRendue() {
    const { createProject } = await import('@/lib/services/projectService')
    const { createTask, joinTask } = await import('@/lib/services/taskService')
    const { submitTask } = await import('@/lib/services/submissionService')

    const project = await createProject(t.prisma, chef, { title: 'Camp' })
    const task = await createTask(t.prisma, chef, {
      projectId: project.id, title: 'Budget', phase: 'AGIR', difficulty: 'MOYEN',
    })
    await joinTask(t.prisma, lucie, task.id)
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: '', photos: [] })
    return { task, submissionId }
  }

  it('laisse un chef retirer un participant après une soumission', async () => {
    const { removeParticipantAction } = await import('@/app/(app)/cap/[projectId]/tache/[taskId]/actions')
    const { task } = await tacheRendue()

    const state = await removeParticipantAction(task.id, lucie.id)

    expect(state.success).toMatch(/retiré/i)
    expect(await t.prisma.taskAssignment.count({ where: { taskId: task.id } })).toBe(0)
  })

  it('refuse à un jeune de retirer quelqu un', async () => {
    const { removeParticipantAction } = await import('@/app/(app)/cap/[projectId]/tache/[taskId]/actions')
    const { task } = await tacheRendue()

    currentUser = lucie
    await expect(removeParticipantAction(task.id, lucie.id)).rejects.toThrow('REDIRECT')
  })

  it('laisse un chef annuler une validation et reprend les points', async () => {
    const { cancelValidationAction } = await import('@/app/(app)/cap/[projectId]/tache/[taskId]/actions')
    const { reviewSubmission } = await import('@/lib/services/submissionService')
    const { getScore } = await import('@/lib/services/pointsService')
    const { task, submissionId } = await tacheRendue()

    await reviewSubmission(t.prisma, chef, { submissionId, decision: 'ACCEPTEE' })
    expect(await getScore(t.prisma, lucie.id)).toBe(25)

    const state = await cancelValidationAction(task.id)

    expect(state.success).toMatch(/annulée/i)
    expect(await getScore(t.prisma, lucie.id)).toBe(0)
    expect((await t.prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe('A_CORRIGER')
  })

  it('refuse à un jeune d annuler une validation', async () => {
    const { cancelValidationAction } = await import('@/app/(app)/cap/[projectId]/tache/[taskId]/actions')
    const { task } = await tacheRendue()

    currentUser = lucie
    await expect(cancelValidationAction(task.id)).rejects.toThrow('REDIRECT')
  })
})
