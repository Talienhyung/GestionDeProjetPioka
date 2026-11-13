// src/lib/services/recompenseService.ts
/**
 * Récompenses données à la main par un chef : un écusson, ou des points,
 * toujours avec une raison que le jeune lira.
 */
import type { Db } from '@/lib/db'
import { type Actor, isChef } from '@/lib/domain/types'
import { ForbiddenError, NotFoundError, ValidationError } from './errors'
import { notify } from './notificationService'
import { creditPoints } from './pointsService'

export const MAX_POINTS_A_LA_MAIN = 500

async function jeune(db: Db, actor: Actor, userId: string) {
  if (!isChef(actor)) throw new ForbiddenError('Seuls les chefs peuvent récompenser.')
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user || user.role !== 'JEUNE') throw new NotFoundError('Jeune')
  return user
}

function raison(texte: string): string {
  const r = texte.replace(/\s+/g, ' ').trim()
  if (r.length < 3) throw new ValidationError('Écris pourquoi : le jeune le lira.')
  if (r.length > 300) throw new ValidationError('La raison tient en 300 caractères au plus.')
  return r
}

async function projetVivant(db: Db, projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project || project.status === 'BROUILLON') throw new NotFoundError('CAP')
  return project
}

export interface RemiseBadge {
  userId: string
  badgeId: string
  reason: string
  /** CAP où compter les points du badge. Sans CAP, l'écusson est remis sans ses points. */
  projectId?: string | null
}

export async function awardBadge(db: Db, actor: Actor, input: RemiseBadge): Promise<void> {
  const user = await jeune(db, actor, input.userId)
  const reason = raison(input.reason)
  const badge = await db.badge.findUnique({ where: { id: input.badgeId } })
  if (!badge) throw new NotFoundError('Badge')
  if (await db.userBadge.findFirst({ where: { userId: user.id, badgeId: badge.id } })) {
    throw new ValidationError(`${user.displayName} a déjà l'écusson « ${badge.name} ».`)
  }
  const projectId = input.projectId ? (await projetVivant(db, input.projectId)).id : null

  await db.userBadge.create({
    data: { userId: user.id, badgeId: badge.id, projectId, reason, awardedById: actor.id },
  })
  if (badge.points > 0 && projectId) {
    await creditPoints(db, {
      userId: user.id,
      projectId,
      amount: badge.points,
      reason: 'BADGE',
      badgeId: badge.id,
      awardedById: actor.id,
    })
  }
  await notify(db, user.id, {
    type: 'BADGE',
    message: `${actor.displayName} t'a remis l'écusson « ${badge.name} » : ${reason}`,
    link: '/profil',
  })
}

/** Retire un écusson (remis par erreur, par exemple) et les points qu'il avait rapportés. */
export async function revokeBadge(db: Db, actor: Actor, userId: string, badgeId: string): Promise<void> {
  await jeune(db, actor, userId)
  const remis = await db.userBadge.findFirst({ where: { userId, badgeId } })
  if (!remis) throw new NotFoundError('Écusson')
  await db.userBadge.delete({ where: { id: remis.id } })
  await db.pointsEntry.deleteMany({ where: { userId, badgeId, reason: 'BADGE' } })
}

export interface RemisePoints {
  userId: string
  projectId: string
  amount: number
  reason: string
}

/** Des points en plus (ou en moins), comptés dans un CAP, avec la raison. */
export async function awardPoints(db: Db, actor: Actor, input: RemisePoints): Promise<void> {
  const user = await jeune(db, actor, input.userId)
  const note = raison(input.reason)
  const amount = Math.trunc(Number(input.amount))
  if (!Number.isFinite(amount) || amount === 0) throw new ValidationError('Combien de points ? (pas zéro)')
  if (Math.abs(amount) > MAX_POINTS_A_LA_MAIN) {
    throw new ValidationError(`${MAX_POINTS_A_LA_MAIN} points au plus, dans un sens ou dans l'autre.`)
  }
  const project = await projetVivant(db, input.projectId)

  await creditPoints(db, {
    userId: user.id,
    projectId: project.id,
    amount,
    reason: 'BONUS',
    note,
    awardedById: actor.id,
  })
  await notify(db, user.id, {
    type: 'POINTS',
    message:
      amount > 0
        ? `+${amount} points de ${actor.displayName} : ${note}`
        : `${amount} points, retirés par ${actor.displayName} : ${note}`,
    link: '/profil',
  })
}

/** Tout ce qu'il faut pour la page « récompenser » d'un jeune. */
export async function fichePourRecompenser(db: Db, actor: Actor, userId: string) {
  const user = await jeune(db, actor, userId)
  const [badges, gagnes, points, projets] = await Promise.all([
    db.badge.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.userBadge.findMany({ where: { userId }, orderBy: { earnedAt: 'desc' } }),
    db.pointsEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { task: { select: { title: true } } },
    }),
    db.project.findMany({ where: { status: { not: 'BROUILLON' } }, orderBy: { startedAt: 'desc' } }),
  ])
  return { user, badges, gagnes, points, projets }
}
