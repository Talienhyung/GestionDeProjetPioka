// tests/integration/rolesActions.test.ts
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

describe('actions des rôles', () => {
  beforeEach(async () => {
    t = createTestDb()
    const mk = async (username: string, role: Actor['role']): Promise<Actor> => {
      const u = await t.prisma.user.create({ data: { username, displayName: username, passwordHash: 'x', role } })
      return { id: u.id, role, displayName: username }
    }
    chef = await mk('sarah', 'CHEF')
    lucie = await mk('lucie', 'JEUNE')
    await t.prisma.project.create({ data: { title: 'Camp' } })
  })
  afterEach(async () => { await t.cleanup() })

  it('candidature puis attribution, bout en bout', async () => {
    const { applyAction, createRoleAction, decideApplicationAction } = await import('@/app/(app)/cap/[projectId]/roles/actions')

    currentUser = chef
    const projet = await t.prisma.project.findFirstOrThrow()
    const form = new FormData()
    form.set('projectId', projet.id)
    form.set('name', 'Trésorier')
    form.set('points', '60')
    expect((await createRoleAction({}, form)).success).toBeTruthy()

    const role = await t.prisma.projectRole.findFirstOrThrow()

    currentUser = lucie
    expect((await applyAction(role.projectId, role.id)).success).toMatch(/Candidature/)

    currentUser = chef
    expect((await decideApplicationAction(role.projectId, role.id, lucie.id, true)).success).toMatch(/attribué/)
    expect((await t.prisma.projectRole.findUniqueOrThrow({ where: { id: role.id } })).holderId).toBe(lucie.id)
  })

  it('rend un message d erreur sur une double candidature', async () => {
    const { applyAction, createRoleAction } = await import('@/app/(app)/cap/[projectId]/roles/actions')

    currentUser = chef
    const projet = await t.prisma.project.findFirstOrThrow()
    const form = new FormData()
    form.set('projectId', projet.id)
    form.set('name', 'Intendant')
    form.set('points', '40')
    await createRoleAction({}, form)
    const role = await t.prisma.projectRole.findFirstOrThrow()

    currentUser = lucie
    await applyAction(role.projectId, role.id)
    expect((await applyAction(role.projectId, role.id)).error).toMatch(/déjà/)
  })
})
