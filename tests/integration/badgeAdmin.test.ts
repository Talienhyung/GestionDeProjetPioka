import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Actor } from '@/lib/domain/types'
import {
  type BadgeInput,
  createBadge,
  deleteBadge,
  getRecentColors,
  updateBadge,
} from '@/lib/services/badgeAdminService'
import { refreshBadges } from '@/lib/services/badgeService'
import { createTestDb, type TestDb } from '../helpers/db'

const base: BadgeInput = {
  name: 'Cuistot',
  description: 'A nourri la caravane.',
  ruleType: 'TACHES_VALIDEES',
  threshold: 1,
  points: 10,
  sortOrder: 1,
  level: 3,
  color: '#FF8300',
  pictoKey: 'gamelle',
}

describe('gestion des badges', () => {
  let t: TestDb
  let admin: Actor
  let chef: Actor

  beforeEach(async () => {
    t = await createTestDb()
    const mk = async (username: string, role: Actor['role']): Promise<Actor> => {
      const u = await t.prisma.user.create({ data: { username, displayName: username, passwordHash: 'x', role } })
      return { id: u.id, role, displayName: username }
    }
    admin = await mk('admin', 'SUPER_ADMIN')
    chef = await mk('sarah', 'CHEF')
  })
  afterEach(async () => {
    await t.cleanup()
  })

  it('crée un badge avec son apparence et retient la couleur', async () => {
    const badge = await createBadge(t.prisma, admin, base)
    expect(badge).toMatchObject({ code: 'cuistot', color: '#ff8300', level: 3, pictoKey: 'gamelle', imageName: null })
    expect(await getRecentColors(t.prisma)).toEqual(['#ff8300'])

    const deuxieme = await createBadge(t.prisma, admin, { ...base, color: '#123456' })
    expect(deuxieme.code).toBe('cuistot_2')
    expect(await getRecentColors(t.prisma)).toEqual(['#123456', '#ff8300'])
  })

  it('réserve la gestion au super admin', async () => {
    await expect(createBadge(t.prisma, chef, base)).rejects.toThrow()
  })

  it('refuse un badge incomplet ou incohérent', async () => {
    await expect(createBadge(t.prisma, admin, { ...base, name: '  ' })).rejects.toThrow(/nom/)
    await expect(createBadge(t.prisma, admin, { ...base, color: 'bleu' })).rejects.toThrow(/Couleur/)
    await expect(createBadge(t.prisma, admin, { ...base, pictoKey: 'nexiste_pas' })).rejects.toThrow(/Pictogramme/)
    await expect(createBadge(t.prisma, admin, { ...base, pictoKey: null })).rejects.toThrow(/pictogramme ou/)
    await expect(createBadge(t.prisma, admin, { ...base, threshold: 0 })).rejects.toThrow(/Seuil/)
    await expect(createBadge(t.prisma, admin, { ...base, ruleType: 'TRICHE' })).rejects.toThrow(/Condition/)
  })

  it("remplace l'image et rend l'ancienne pour qu'on l'efface", async () => {
    const badge = await createBadge(t.prisma, admin, { ...base, pictoKey: null, imageName: 'a'.repeat(32) + '.webp' })

    const remplace = await updateBadge(t.prisma, admin, badge.id, { ...base, imageName: 'b'.repeat(32) + '.webp' })
    expect(remplace.badge.imageName).toBe('b'.repeat(32) + '.webp')
    expect(remplace.obsoleteImage).toBe('a'.repeat(32) + '.webp')

    const garde = await updateBadge(t.prisma, admin, badge.id, { ...base, name: 'Chef cuistot' })
    expect(garde.badge.imageName).toBe('b'.repeat(32) + '.webp')
    expect(garde.obsoleteImage).toBeNull()

    const retire = await updateBadge(t.prisma, admin, badge.id, { ...base, removeImage: true })
    expect(retire.badge.imageName).toBeNull()
    expect(retire.obsoleteImage).toBe('b'.repeat(32) + '.webp')
  })

  it('supprime un badge des profils mais garde les points gagnés', async () => {
    const jeune = await t.prisma.user.create({ data: { username: 'lucie', displayName: 'Lucie', passwordHash: 'x', role: 'JEUNE' } })
    const projet = await t.prisma.project.create({ data: { title: 'Camp' } })
    const tache = await t.prisma.task.create({
      data: { projectId: projet.id, title: 'Courses', phase: 'AGIR', difficulty: 'FACILE', status: 'TERMINEE', createdById: chef.id },
    })
    await t.prisma.taskAssignment.create({ data: { taskId: tache.id, userId: jeune.id } })
    const badge = await createBadge(t.prisma, admin, base)

    expect(await refreshBadges(t.prisma, jeune.id, projet.id)).toEqual(['cuistot'])
    expect(await t.prisma.pointsEntry.count({ where: { userId: jeune.id, reason: 'BADGE' } })).toBe(1)

    await deleteBadge(t.prisma, admin, badge.id)
    expect(await t.prisma.userBadge.count()).toBe(0)
    expect(await t.prisma.pointsEntry.count({ where: { userId: jeune.id, reason: 'BADGE' } })).toBe(1)
  })
})
