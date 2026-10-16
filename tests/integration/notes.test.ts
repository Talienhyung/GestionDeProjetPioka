import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Actor } from '@/lib/domain/types'
import { createNote, deleteNote, listNotes, setPinned, updateNote } from '@/lib/services/noteService'
import { archiveProject, createProject, launchProject } from '@/lib/services/projectService'
import { createTestDb, type TestDb } from '../helpers/db'

describe('tableau de billets', () => {
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
    await launchProject(t.prisma, chef, projectId)
  })
  afterEach(async () => { await t.cleanup() })

  it('écrit un billet sur le tableau de la caravane et sur celui d’un CAP', async () => {
    await createNote(t.prisma, lucie, { projectId: null, title: 'Covoiturage', body: 'Qui a une voiture ?' })
    await createNote(t.prisma, tom, { projectId, title: 'Veillée', body: 'Loup-garou géant' })

    const caravane = await listNotes(t.prisma, null)
    const cap = await listNotes(t.prisma, projectId)

    expect(caravane.map((n) => n.title)).toEqual(['Covoiturage'])
    expect(cap.map((n) => n.title)).toEqual(['Veillée'])
    expect(caravane[0].author.displayName).toBe('lucie')
  })

  it('refuse un billet vide et tronque ce qui dépasse', async () => {
    await expect(createNote(t.prisma, lucie, { projectId: null, title: '', body: '   ' }))
      .rejects.toThrow(/vide/i)
    await expect(
      createNote(t.prisma, lucie, { projectId: null, title: 'x'.repeat(81), body: 'ok' }),
    ).rejects.toThrow(/80/)
    await expect(
      createNote(t.prisma, lucie, { projectId: null, title: '', body: 'x'.repeat(2001) }),
    ).rejects.toThrow(/2 ?000/)
  })

  it('remonte les billets épinglés, puis les plus récemment modifiés', async () => {
    const vieux = await createNote(t.prisma, lucie, { projectId: null, title: 'Vieux', body: 'a' })
    await createNote(t.prisma, tom, { projectId: null, title: 'Récent', body: 'b' })
    await setPinned(t.prisma, chef, vieux.id, true)

    expect((await listNotes(t.prisma, null)).map((n) => n.title)).toEqual(['Vieux', 'Récent'])
  })

  it('laisse chacun modifier le sien, et personne d’autre', async () => {
    const billet = await createNote(t.prisma, lucie, { projectId: null, title: 'Menus', body: 'pâtes' })

    const modifie = await updateNote(t.prisma, lucie, billet.id, { title: 'Menus', body: 'pâtes et riz' })
    expect(modifie.body).toBe('pâtes et riz')

    await expect(updateNote(t.prisma, tom, billet.id, { title: 'Menus', body: 'pizza' }))
      .rejects.toThrow(/ton billet/i)
    // Un chef modère, il ne réécrit pas les mots d'un jeune.
    await expect(updateNote(t.prisma, chef, billet.id, { title: 'Menus', body: 'pizza' }))
      .rejects.toThrow(/ton billet/i)
  })

  it('laisse l’auteur et les chefs supprimer, mais pas les autres jeunes', async () => {
    const billet = await createNote(t.prisma, lucie, { projectId: null, title: 'À effacer', body: 'oups' })

    await expect(deleteNote(t.prisma, tom, billet.id)).rejects.toThrow()

    await deleteNote(t.prisma, chef, billet.id)
    expect(await listNotes(t.prisma, null)).toEqual([])

    const autre = await createNote(t.prisma, lucie, { projectId: null, title: 'Mien', body: 'x' })
    await deleteNote(t.prisma, lucie, autre.id)
    expect(await listNotes(t.prisma, null)).toEqual([])
  })

  it('réserve l’épinglage aux chefs', async () => {
    const billet = await createNote(t.prisma, lucie, { projectId: null, title: 'Important', body: 'x' })

    await expect(setPinned(t.prisma, lucie, billet.id, true)).rejects.toThrow()
    expect((await setPinned(t.prisma, chef, billet.id, true)).pinned).toBe(true)
    expect((await setPinned(t.prisma, chef, billet.id, false)).pinned).toBe(false)
  })

  it('ferme le tableau d’un CAP archivé', async () => {
    const billet = await createNote(t.prisma, lucie, { projectId, title: 'Avant', body: 'x' })
    await archiveProject(t.prisma, chef, projectId)

    await expect(createNote(t.prisma, lucie, { projectId, title: 'Après', body: 'x' }))
      .rejects.toThrow(/archivé/i)
    await expect(updateNote(t.prisma, lucie, billet.id, { title: 'Avant', body: 'y' }))
      .rejects.toThrow(/archivé/i)
    expect((await listNotes(t.prisma, projectId)).length).toBe(1)
  })

  it('refuse d’écrire sur le tableau d’un CAP que l’on ne voit pas', async () => {
    const brouillon = await createProject(t.prisma, chef, { title: 'Secret' })

    await expect(createNote(t.prisma, lucie, { projectId: brouillon.id, title: 'Hop', body: 'x' }))
      .rejects.toThrow()
    await expect(createNote(t.prisma, chef, { projectId: brouillon.id, title: 'Hop', body: 'x' }))
      .resolves.toBeTruthy()
  })
})
