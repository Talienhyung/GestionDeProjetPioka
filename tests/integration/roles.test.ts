// tests/integration/roles.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Actor } from '@/lib/domain/types'
import { getScore } from '@/lib/services/pointsService'
import { archiveProject, createProject } from '@/lib/services/projectService'
import { applyToRole, closeRole, createRole, decideApplication, listRoles } from '@/lib/services/roleService'
import { createTestDb, type TestDb } from '../helpers/db'

describe('rôles du CAP', () => {
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
    await t.prisma.badge.create({
      data: { code: 'responsable', name: 'Responsable', description: 'un rôle tenu', icon: '🎖️', ruleType: 'ROLE_CLOTURE', threshold: 1, points: 15 },
    })
  })
  afterEach(async () => { await t.cleanup() })

  const roleTresorier = () => createRole(t.prisma, chef, { projectId, name: 'Trésorier', points: 60 })

  it('crée un rôle, réservé aux chefs', async () => {
    const role = await roleTresorier()
    expect(role.name).toBe('Trésorier')
    await expect(createRole(t.prisma, lucie, { projectId, name: 'Chef secret', points: 1 })).rejects.toThrow()
  })

  it('enregistre une candidature et prévient les chefs', async () => {
    const role = await roleTresorier()
    await applyToRole(t.prisma, lucie, role.id)
    expect(await t.prisma.roleApplication.count({ where: { projectRoleId: role.id } })).toBe(1)
    expect(await t.prisma.notification.count({ where: { userId: chef.id, type: 'CANDIDATURE' } })).toBe(1)
  })

  it('refuse deux candidatures du même jeune', async () => {
    const role = await roleTresorier()
    await applyToRole(t.prisma, lucie, role.id)
    await expect(applyToRole(t.prisma, lucie, role.id)).rejects.toThrow(/déjà/)
  })

  it('attribue le rôle à un candidat et refuse automatiquement les autres', async () => {
    const role = await roleTresorier()
    await applyToRole(t.prisma, lucie, role.id)
    await applyToRole(t.prisma, tom, role.id)

    await decideApplication(t.prisma, chef, { projectRoleId: role.id, userId: lucie.id, accept: true })

    const apres = await t.prisma.projectRole.findUniqueOrThrow({
      where: { id: role.id },
      include: { applications: true },
    })
    expect(apres.holderId).toBe(lucie.id)
    expect(apres.applications.find((a) => a.userId === lucie.id)!.status).toBe('ACCEPTEE')
    expect(apres.applications.find((a) => a.userId === tom.id)!.status).toBe('REFUSEE')
    expect(await t.prisma.notification.count({ where: { userId: tom.id, type: 'CANDIDATURE_REFUSEE' } })).toBe(1)
  })

  it('refuse d attribuer un rôle déjà tenu à un second candidat', async () => {
    // Les deux candidatures arrivent AVANT l'attribution : c'est le seul chemin
    // qui atteint la garde, applyToRole refusant déjà un rôle tenu.
    const role = await roleTresorier()
    await applyToRole(t.prisma, lucie, role.id)
    await applyToRole(t.prisma, tom, role.id)
    await decideApplication(t.prisma, chef, { projectRoleId: role.id, userId: lucie.id, accept: true })

    await expect(decideApplication(t.prisma, chef, { projectRoleId: role.id, userId: tom.id, accept: true }))
      .rejects.toThrow(/déjà tenu/)
  })

  it('refuse une candidature sur un rôle déjà tenu', async () => {
    const role = await roleTresorier()
    await applyToRole(t.prisma, lucie, role.id)
    await decideApplication(t.prisma, chef, { projectRoleId: role.id, userId: lucie.id, accept: true })

    await expect(applyToRole(t.prisma, tom, role.id)).rejects.toThrow(/déjà tenu/)
  })

  it('verse les points et le badge à la clôture du rôle', async () => {
    const role = await roleTresorier()
    await applyToRole(t.prisma, lucie, role.id)
    await decideApplication(t.prisma, chef, { projectRoleId: role.id, userId: lucie.id, accept: true })

    const result = await closeRole(t.prisma, chef, role.id)

    expect(result.awarded).toBe(60)
    expect(result.newBadges).toEqual(['responsable'])
    expect(await getScore(t.prisma, lucie.id)).toBe(75)
  })

  it('refuse de clôturer deux fois ou un rôle sans titulaire', async () => {
    const role = await roleTresorier()
    await expect(closeRole(t.prisma, chef, role.id)).rejects.toThrow(/titulaire/)

    await applyToRole(t.prisma, lucie, role.id)
    await decideApplication(t.prisma, chef, { projectRoleId: role.id, userId: lucie.id, accept: true })
    await closeRole(t.prisma, chef, role.id)
    await expect(closeRole(t.prisma, chef, role.id)).rejects.toThrow(/déjà clôturé/)
  })

  it('liste les rôles avec titulaire et candidatures en attente', async () => {
    const role = await roleTresorier()
    await applyToRole(t.prisma, tom, role.id)

    const roles = await listRoles(t.prisma, projectId)
    expect(roles[0].applications.length).toBe(1)
    expect(roles[0].holder).toBeNull()
  })

  it('refuse d attribuer un rôle sur un CAP archivé', async () => {
    const role = await roleTresorier()
    await applyToRole(t.prisma, lucie, role.id)
    await archiveProject(t.prisma, chef, projectId)

    await expect(decideApplication(t.prisma, chef, { projectRoleId: role.id, userId: lucie.id, accept: true }))
      .rejects.toThrow(/archiv/i)
  })

  it('refuse de clôturer un rôle sur un CAP archivé, sans verser de points', async () => {
    const role = await roleTresorier()
    await applyToRole(t.prisma, lucie, role.id)
    await decideApplication(t.prisma, chef, { projectRoleId: role.id, userId: lucie.id, accept: true })
    await archiveProject(t.prisma, chef, projectId)

    await expect(closeRole(t.prisma, chef, role.id)).rejects.toThrow(/archiv/i)
    expect(await getScore(t.prisma, lucie.id)).toBe(0)
  })
})
