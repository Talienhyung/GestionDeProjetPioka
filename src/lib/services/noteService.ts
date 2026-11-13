import type { Db } from '@/lib/db'
import type { Actor } from '@/lib/domain/types'
import { isChef } from '@/lib/domain/types'
import { ForbiddenError, NotFoundError, ValidationError } from './errors'
import { getVisibleProject } from './projectService'

export const TITRE_MAX = 80
export const TEXTE_MAX = 2000

export interface NoteInput {
  /** Vide : le tableau de la caravane. Rempli : celui d'un CAP. */
  projectId: string | null
  title: string
  body: string
  /** Photo déjà enregistrée : le billet devient un polaroid, sans texte. */
  imageName?: string | null
}

function assainir(input: Pick<NoteInput, 'title' | 'body'>, photo: boolean) {
  const title = input.title.trim()
  // Un polaroid n'a que sa légende : le texte éventuel est ignoré.
  const body = photo ? '' : input.body.trim()

  if (!photo && body.length === 0) throw new ValidationError('Un billet vide ne sert à rien : écris quelque chose.')
  if (title.length > TITRE_MAX) throw new ValidationError(`Le titre ne peut pas dépasser ${TITRE_MAX} caractères.`)
  if (body.length > TEXTE_MAX) throw new ValidationError(`Le billet ne peut pas dépasser 2 000 caractères.`)

  return { title, body }
}

/**
 * Le tableau doit être ouvert à l'écriture : un CAP archivé est figé, et un
 * brouillon n'existe pas pour un jeune.
 */
async function assertTableauOuvert(db: Db, actor: Actor, projectId: string | null) {
  if (projectId === null) return
  const project = await getVisibleProject(db, actor, projectId)
  if (project.status === 'ARCHIVE') throw new ValidationError('Ce CAP est archivé : son tableau est figé.')
}

export async function listNotes(db: Db, projectId: string | null) {
  return db.note.findMany({
    where: { projectId },
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    include: { author: { select: { id: true, displayName: true } } },
  })
}

export async function createNote(db: Db, actor: Actor, input: NoteInput) {
  const imageName = input.imageName ?? null
  const { title, body } = assainir(input, imageName !== null)
  await assertTableauOuvert(db, actor, input.projectId)

  return db.note.create({
    data: { projectId: input.projectId, title, body, imageName, authorId: actor.id },
  })
}

/** Chacun ses mots : seul l'auteur réécrit son billet, chef compris. */
export async function updateNote(db: Db, actor: Actor, noteId: string, input: Pick<NoteInput, 'title' | 'body'>) {
  const note = await db.note.findUnique({ where: { id: noteId } })
  if (!note) throw new NotFoundError('Billet')
  if (note.authorId !== actor.id) throw new ForbiddenError('Tu ne peux modifier que ton billet.')

  const { title, body } = assainir(input, note.imageName !== null)
  await assertTableauOuvert(db, actor, note.projectId)

  return db.note.update({ where: { id: noteId }, data: { title, body } })
}

/** Effacer est un geste de modération : l'auteur ou un chef. Rend la photo à effacer du stockage. */
export async function deleteNote(db: Db, actor: Actor, noteId: string): Promise<string | null> {
  const note = await db.note.findUnique({ where: { id: noteId } })
  if (!note) throw new NotFoundError('Billet')
  if (note.authorId !== actor.id && !isChef(actor)) {
    throw new ForbiddenError('Seul l’auteur du billet ou un chef peut le supprimer.')
  }
  await assertTableauOuvert(db, actor, note.projectId)

  await db.note.delete({ where: { id: noteId } })
  return note.imageName
}

/** Photo d'un billet, si ce billet est visible de cette personne. */
export async function noteImageFor(db: Db, actor: Actor, noteId: string): Promise<string | null> {
  const note = await db.note.findUnique({ where: { id: noteId }, select: { imageName: true, projectId: true } })
  if (!note?.imageName) return null
  if (note.projectId !== null) await getVisibleProject(db, actor, note.projectId)
  return note.imageName
}

/** Épingler est réservé aux chefs : sinon tout remonte et plus rien ne ressort. */
export async function setPinned(db: Db, actor: Actor, noteId: string, pinned: boolean) {
  if (!isChef(actor)) throw new ForbiddenError('Seul un chef peut épingler un billet.')

  const note = await db.note.findUnique({ where: { id: noteId } })
  if (!note) throw new NotFoundError('Billet')
  await assertTableauOuvert(db, actor, note.projectId)

  return db.note.update({ where: { id: noteId }, data: { pinned } })
}

/** Les derniers billets, tous tableaux confondus, pour l'accueil. */
export async function listRecentNotes(db: Db, actor: Actor, limit = 2) {
  const visibles = await db.project.findMany({
    where: isChef(actor) ? {} : { status: { not: 'BROUILLON' } },
    select: { id: true },
  })

  return db.note.findMany({
    where: { OR: [{ projectId: null }, { projectId: { in: visibles.map((p) => p.id) } }] },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    include: {
      author: { select: { displayName: true } },
      project: { select: { id: true, title: true } },
    },
  })
}
