// tests/integration/adminActions.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Actor } from '@/lib/domain/types'
import { createTestDb, type TestDb } from '../helpers/db'

let t: TestDb
let admin: Actor
let chef: Actor
let currentUser: Actor

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/guard', () => ({
  requireSuperAdmin: async () => {
    if (currentUser.role !== 'SUPER_ADMIN') throw new Error('REDIRECT')
    return currentUser
  },
  requireChef: async () => {
    if (currentUser.role === 'JEUNE') throw new Error('REDIRECT')
    return currentUser
  },
  requireUser: async () => currentUser,
}))
vi.mock('@/lib/db', () => ({ get db() { return t.prisma } }))

describe('actions d administration', () => {
  beforeEach(async () => {
    t = createTestDb()
    const mk = async (username: string, role: Actor['role']): Promise<Actor> => {
      const u = await t.prisma.user.create({ data: { username, displayName: username, passwordHash: 'x', role } })
      return { id: u.id, role, displayName: username }
    }
    admin = await mk('admin', 'SUPER_ADMIN')
    chef = await mk('sarah', 'CHEF')
    currentUser = admin
  })
  afterEach(async () => { await t.cleanup() })

  it('crée un compte et affiche le mot de passe provisoire une fois', async () => {
    const { createUserAction } = await import('@/app/(admin)/comptes/actions')
    const form = new FormData()
    form.set('username', 'lucie')
    form.set('displayName', 'Lucie M.')
    form.set('role', 'JEUNE')

    const state = await createUserAction({}, form)
    expect(state.success).toMatch(/Mot de passe provisoire : [a-z2-9]{12}/)
  })

  it('refuse la création de compte à un chef', async () => {
    const { createUserAction } = await import('@/app/(admin)/comptes/actions')
    currentUser = chef
    const form = new FormData()
    form.set('username', 'tom')
    form.set('displayName', 'Tom')
    await expect(createUserAction({}, form)).rejects.toThrow('REDIRECT')
  })

  it('refuse un barème à zéro ou négatif', async () => {
    const { setScaleAction } = await import('@/app/(admin)/parametres/actions')
    const form = new FormData()
    form.set('FACILE', '0')
    form.set('MOYEN', '25')
    form.set('DIFFICILE', '50')
    expect((await setScaleAction({}, form)).error).toMatch(/supérieur à zéro/)
  })

  it('démarre un nouveau CAP en archivant le précédent', async () => {
    const { newProjectAction } = await import('@/app/(chef)/pilotage/actions')
    currentUser = chef
    await t.prisma.project.create({ data: { title: 'CAP 2026' } })

    const form = new FormData()
    form.set('title', 'CAP 2027')
    expect((await newProjectAction({}, form)).success).toMatch(/démarré/)

    const projets = await t.prisma.project.findMany({ orderBy: { startedAt: 'asc' } })
    expect(projets.map((p) => p.status)).toEqual(['ARCHIVE', 'EN_COURS'])
  })
})
