import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Actor } from '@/lib/domain/types'
import {
  archiveProject,
  createProject,
  deleteProject,
  deletionImpact,
  getVisibleProject,
  launchProject,
  listLiveProjects,
  listProjects,
  setProjectCover,
} from '@/lib/services/projectService'
import { createTask } from '@/lib/services/taskService'
import { createTestDb, type TestDb } from '../helpers/db'

describe('cycle de vie des CAP', () => {
  let t: TestDb
  let chef: Actor
  let lucie: Actor

  beforeEach(async () => {
    t = await createTestDb()
    const mk = async (username: string, role: Actor['role']): Promise<Actor> => {
      const u = await t.prisma.user.create({ data: { username, displayName: username, passwordHash: 'x', role } })
      return { id: u.id, role, displayName: username }
    }
    chef = await mk('sarah', 'CHEF')
    lucie = await mk('lucie', 'JEUNE')
  })
  afterEach(async () => { await t.cleanup() })

  it('crée un CAP en brouillon, invisible des jeunes', async () => {
    const projet = await createProject(t.prisma, chef, { title: 'Camp 2027' })

    expect(projet.status).toBe('BROUILLON')
    expect(await listLiveProjects(t.prisma)).toEqual([])
    await expect(getVisibleProject(t.prisma, lucie, projet.id)).rejects.toThrow()
    expect(await getVisibleProject(t.prisma, chef, projet.id)).toMatchObject({ id: projet.id })
  })

  it('lance un brouillon et prévient les jeunes', async () => {
    const projet = await createProject(t.prisma, chef, { title: 'Camp 2027' })

    const lance = await launchProject(t.prisma, chef, projet.id)

    expect(lance.status).toBe('EN_COURS')
    expect(await getVisibleProject(t.prisma, lucie, projet.id)).toMatchObject({ id: projet.id })
    expect(await t.prisma.notification.count({ where: { userId: lucie.id, type: 'CAP_LANCE' } })).toBe(1)
  })

  it('refuse de lancer deux fois, ou de lancer un CAP archivé', async () => {
    const projet = await createProject(t.prisma, chef, { title: 'Camp 2027' })
    await launchProject(t.prisma, chef, projet.id)

    await expect(launchProject(t.prisma, chef, projet.id)).rejects.toThrow(/déjà/)

    await archiveProject(t.prisma, chef, projet.id)
    await expect(launchProject(t.prisma, chef, projet.id)).rejects.toThrow()
  })

  it('laisse plusieurs CAP en cours coexister : en créer un n’archive plus les autres', async () => {
    const camp = await createProject(t.prisma, chef, { title: "Camp d'été" })
    await launchProject(t.prisma, chef, camp.id)
    const solidarite = await createProject(t.prisma, chef, { title: 'Action solidarité' })
    await launchProject(t.prisma, chef, solidarite.id)

    const vivants = await listLiveProjects(t.prisma)
    expect(vivants.map((p) => p.title).sort()).toEqual(['Action solidarité', "Camp d'été"])
    expect((await t.prisma.project.findUniqueOrThrow({ where: { id: camp.id } })).status).toBe('EN_COURS')
  })

  it('archive un seul CAP sans toucher aux autres', async () => {
    const camp = await createProject(t.prisma, chef, { title: "Camp d'été" })
    await launchProject(t.prisma, chef, camp.id)
    const solidarite = await createProject(t.prisma, chef, { title: 'Action solidarité' })
    await launchProject(t.prisma, chef, solidarite.id)

    await archiveProject(t.prisma, chef, camp.id)

    expect((await listLiveProjects(t.prisma)).map((p) => p.title)).toEqual(['Action solidarité'])
    expect((await listProjects(t.prisma)).length).toBe(2)
  })

  it('accepte les tâches d’un chef sur un brouillon, mais pas celles d’un jeune', async () => {
    const projet = await createProject(t.prisma, chef, { title: 'Camp 2027' })

    const tache = await createTask(t.prisma, chef, {
      projectId: projet.id, title: 'Préparer le budget', phase: 'AGIR', difficulty: 'MOYEN',
    })
    expect(tache.status).toBe('OUVERTE')

    await expect(
      createTask(t.prisma, lucie, { projectId: projet.id, title: 'Idée', phase: 'AGIR', difficulty: 'FACILE' }),
    ).rejects.toThrow(/pas encore lancé/i)
  })

  it('refuse la création de CAP à un jeune', async () => {
    await expect(createProject(t.prisma, lucie, { title: 'Mon projet' })).rejects.toThrow()
  })

  it('supprime un CAP et tout ce qu’il contient, et rend les images à effacer', async () => {
    const projet = await createProject(t.prisma, chef, { title: 'Camp 2027', coverName: 'c'.repeat(32) + '.webp' })
    const autre = await createProject(t.prisma, chef, { title: 'Autre CAP' })
    const tache = await t.prisma.task.create({
      data: { projectId: projet.id, title: 'Budget', phase: 'CHOISIR', difficulty: 'FACILE', status: 'EN_VALIDATION', createdById: chef.id },
    })
    await t.prisma.taskAssignment.create({ data: { taskId: tache.id, userId: lucie.id } })
    const rendu = await t.prisma.submission.create({ data: { taskId: tache.id, submittedById: lucie.id, message: 'fait' } })
    await t.prisma.attachment.create({
      data: { submissionId: rendu.id, storedName: 'd'.repeat(32) + '.webp', originalName: 'p.jpg', mimeType: 'image/webp', sizeBytes: 1, width: 1, height: 1, uploadedById: lucie.id },
    })
    await t.prisma.pointsEntry.create({ data: { userId: lucie.id, projectId: projet.id, amount: 5, reason: 'BONUS' } })
    const badge = await t.prisma.badge.create({ data: { code: 'b', name: 'B', description: '', icon: '', ruleType: 'TACHES_VALIDEES' } })
    await t.prisma.userBadge.create({ data: { userId: lucie.id, badgeId: badge.id, projectId: projet.id } })

    expect(await deletionImpact(t.prisma, projet.id)).toEqual({ taches: 1, points: 1, roles: 0, billets: 0 })
    await expect(deleteProject(t.prisma, lucie, projet.id)).rejects.toThrow()

    const fichiers = await deleteProject(t.prisma, chef, projet.id)
    expect(fichiers.sort()).toEqual(['c'.repeat(32) + '.webp', 'd'.repeat(32) + '.webp'])
    expect(await t.prisma.project.findUnique({ where: { id: projet.id } })).toBeNull()
    expect(await t.prisma.task.count()).toBe(0)
    expect(await t.prisma.attachment.count()).toBe(0)
    expect(await t.prisma.pointsEntry.count()).toBe(0)
    // L'écusson reste au jeune, il ne pointe simplement plus vers ce CAP.
    expect(await t.prisma.userBadge.findFirst()).toMatchObject({ projectId: null })
    expect(await t.prisma.project.findUnique({ where: { id: autre.id } })).not.toBeNull()
  })

  it('change la couverture et rend l’ancienne', async () => {
    const projet = await createProject(t.prisma, chef, { title: 'Camp 2027' })
    expect(await setProjectCover(t.prisma, chef, projet.id, 'e'.repeat(32) + '.webp')).toBeNull()
    expect(await setProjectCover(t.prisma, chef, projet.id, null)).toBe('e'.repeat(32) + '.webp')
    await expect(setProjectCover(t.prisma, lucie, projet.id, null)).rejects.toThrow()
  })
})
