import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Actor } from '@/lib/domain/types'
import {
  archiveProject,
  createProject,
  getVisibleProject,
  launchProject,
  listLiveProjects,
  listProjects,
} from '@/lib/services/projectService'
import { createTask } from '@/lib/services/taskService'
import { createTestDb, type TestDb } from '../helpers/db'

describe('cycle de vie des CAP', () => {
  let t: TestDb
  let chef: Actor
  let lucie: Actor

  beforeEach(async () => {
    t = createTestDb()
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
})
