// tests/integration/validationActions.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Actor } from '@/lib/domain/types'
import { createTestDb, type TestDb } from '../helpers/db'

let t: TestDb
let chef: Actor
let lucie: Actor
let currentUser: Actor

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/guard', () => ({
  requireChef: async () => {
    if (currentUser.role === 'JEUNE') throw new Error('REDIRECT')
    return currentUser
  },
  requireUser: async () => currentUser,
}))
vi.mock('@/lib/db', () => ({ get db() { return t.prisma } }))

describe('actions de validation', () => {
  beforeEach(async () => {
    t = createTestDb()
    const mk = async (username: string, role: Actor['role']): Promise<Actor> => {
      const u = await t.prisma.user.create({ data: { username, displayName: username, passwordHash: 'x', role } })
      return { id: u.id, role, displayName: username }
    }
    chef = await mk('sarah', 'CHEF')
    lucie = await mk('lucie', 'JEUNE')
    currentUser = chef
  })
  afterEach(async () => { await t.cleanup() })

  it('valide une soumission et rend un message lisible', async () => {
    const { createProject } = await import('@/lib/services/projectService')
    const { createTask, joinTask } = await import('@/lib/services/taskService')
    const { submitTask } = await import('@/lib/services/submissionService')
    const { reviewAction } = await import('@/app/(chef)/validation/actions')

    const project = await createProject(t.prisma, chef, { title: 'Camp' })
    const task = await createTask(t.prisma, chef, { projectId: project.id, title: 'Budget', phase: 'AGIR', difficulty: 'MOYEN' })
    await joinTask(t.prisma, lucie, task.id)
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: '', photos: [] })

    const form = new FormData()
    form.set('submissionId', submissionId)
    form.set('decision', 'ACCEPTEE')
    form.set('bonus', '0')

    const state = await reviewAction({}, form)
    expect(state.success).toMatch(/25 points/)
  })

  it('rend un message d erreur quand le refus n a pas de commentaire', async () => {
    const { createProject } = await import('@/lib/services/projectService')
    const { createTask, joinTask } = await import('@/lib/services/taskService')
    const { submitTask } = await import('@/lib/services/submissionService')
    const { reviewAction } = await import('@/app/(chef)/validation/actions')

    const project = await createProject(t.prisma, chef, { title: 'Camp' })
    const task = await createTask(t.prisma, chef, { projectId: project.id, title: 'Budget', phase: 'AGIR', difficulty: 'MOYEN' })
    await joinTask(t.prisma, lucie, task.id)
    const { submissionId } = await submitTask(t.prisma, lucie, { taskId: task.id, message: '', photos: [] })

    const form = new FormData()
    form.set('submissionId', submissionId)
    form.set('decision', 'REFUSEE')
    form.set('comment', '')

    expect((await reviewAction({}, form)).error).toMatch(/commentaire/i)
  })
})
