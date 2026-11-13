// src/lib/services/groupeService.ts
/** Les groupes de jeunes (équipes), composés par les chefs. */
import type { Db } from '@/lib/db'
import { normaliserCouleur } from '@/lib/domain/badgeLook'
import { type Actor, isChef } from '@/lib/domain/types'
import { ForbiddenError, NotFoundError, ValidationError } from './errors'

function exigerChef(actor: Actor) {
  if (!isChef(actor)) throw new ForbiddenError('Seuls les chefs composent les groupes.')
}

function nomValide(nom: string): string {
  const n = nom.replace(/\s+/g, ' ').trim()
  if (n.length < 2) throw new ValidationError('Donne un nom au groupe.')
  if (n.length > 40) throw new ValidationError('Le nom tient en 40 caractères au plus.')
  return n
}

async function nomLibre(db: Db, nom: string, saufId?: string) {
  const tous = await db.groupe.findMany({ select: { id: true, name: true } })
  if (tous.some((g) => g.id !== saufId && g.name.toLowerCase() === nom.toLowerCase())) {
    throw new ValidationError(`Il y a déjà un groupe « ${nom} ».`)
  }
}

/** Les groupes, par nom, avec leurs jeunes actifs ; puis les jeunes sans groupe. */
export async function listGroupes(db: Db) {
  const [groupes, jeunes] = await Promise.all([
    db.groupe.findMany({ orderBy: { name: 'asc' } }),
    db.user.findMany({
      where: { role: 'JEUNE', isActive: true },
      orderBy: { displayName: 'asc' },
      select: { id: true, displayName: true, username: true, groupeId: true },
    }),
  ])
  return {
    groupes: groupes.map((g) => ({ ...g, membres: jeunes.filter((j) => j.groupeId === g.id) })),
    sansGroupe: jeunes.filter((j) => !j.groupeId || !groupes.some((g) => g.id === j.groupeId)),
  }
}

export async function createGroupe(db: Db, actor: Actor, input: { name: string; color?: string | null }) {
  exigerChef(actor)
  const name = nomValide(input.name)
  await nomLibre(db, name)
  return db.groupe.create({ data: { name, color: normaliserCouleur(input.color ?? '') ?? null } })
}

export async function updateGroupe(db: Db, actor: Actor, id: string, input: { name: string; color?: string | null }) {
  exigerChef(actor)
  if (!(await db.groupe.findUnique({ where: { id } }))) throw new NotFoundError('Groupe')
  const name = nomValide(input.name)
  await nomLibre(db, name, id)
  return db.groupe.update({ where: { id }, data: { name, color: normaliserCouleur(input.color ?? '') ?? null } })
}

/** Supprime le groupe ; ses jeunes se retrouvent sans groupe. */
export async function deleteGroupe(db: Db, actor: Actor, id: string) {
  exigerChef(actor)
  if (!(await db.groupe.findUnique({ where: { id } }))) throw new NotFoundError('Groupe')
  await db.groupe.delete({ where: { id } })
}

/** Place un jeune dans un groupe, ou l'en sort (null). */
export async function setGroupe(db: Db, actor: Actor, userId: string, groupeId: string | null) {
  exigerChef(actor)
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user || user.role !== 'JEUNE') throw new NotFoundError('Jeune')
  if (groupeId && !(await db.groupe.findUnique({ where: { id: groupeId } }))) throw new NotFoundError('Groupe')
  await db.user.update({ where: { id: userId }, data: { groupeId } })
}
