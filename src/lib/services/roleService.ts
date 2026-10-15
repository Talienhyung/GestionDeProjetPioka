import type { PrismaClient } from '@prisma/client'
import type { Db } from '@/lib/db'
import type { Actor } from '@/lib/domain/types'
import { isChef } from '@/lib/domain/types'
import { refreshBadges } from './badgeService'
import { ForbiddenError, NotFoundError, ValidationError } from './errors'
import { notify, notifyMany } from './notificationService'
import { creditPoints } from './pointsService'

export interface CreateRoleInput {
  projectId: string
  name: string
  description?: string
  points: number
}

export async function createRole(db: Db, actor: Actor, input: CreateRoleInput) {
  if (!isChef(actor)) throw new ForbiddenError()
  if (!input.name.trim()) throw new ValidationError('Le nom du rôle est obligatoire.')
  if (input.points < 0) throw new ValidationError('Les points d\'un rôle ne peuvent pas être négatifs.')

  return db.projectRole.create({
    data: {
      projectId: input.projectId,
      name: input.name.trim(),
      description: input.description?.trim() ?? '',
      points: Math.round(input.points),
    },
  })
}

export async function listRoles(db: Db, projectId: string) {
  return db.projectRole.findMany({
    where: { projectId },
    orderBy: { name: 'asc' },
    include: {
      holder: { select: { id: true, displayName: true } },
      applications: {
        where: { status: 'EN_ATTENTE' },
        include: { user: { select: { id: true, displayName: true } } },
      },
    },
  })
}

export async function applyToRole(db: Db, actor: Actor, projectRoleId: string) {
  const role = await db.projectRole.findUnique({ where: { id: projectRoleId }, include: { project: true } })
  if (!role) throw new NotFoundError('Rôle')
  if (role.project.status === 'ARCHIVE') throw new ValidationError('Ce CAP est archivé.')
  if (role.holderId) throw new ValidationError('Ce rôle est déjà tenu.')

  const existing = await db.roleApplication.findUnique({
    where: { projectRoleId_userId: { projectRoleId, userId: actor.id } },
  })
  if (existing) throw new ValidationError('Tu as déjà posé ta candidature pour ce rôle.')

  const application = await db.roleApplication.create({ data: { projectRoleId, userId: actor.id } })

  const chefs = await db.user.findMany({
    where: { role: { in: ['CHEF', 'SUPER_ADMIN'] }, isActive: true },
    select: { id: true },
  })
  await notifyMany(db, chefs.map((c) => c.id), {
    type: 'CANDIDATURE',
    message: `${actor.displayName} se porte candidat au rôle de ${role.name}`,
    link: '/roles',
  })

  return application
}

export interface DecideApplicationInput {
  projectRoleId: string
  userId: string
  accept: boolean
}

export async function decideApplication(db: PrismaClient, actor: Actor, input: DecideApplicationInput) {
  if (!isChef(actor)) throw new ForbiddenError()

  return db.$transaction(async (tx) => {
    const role = await tx.projectRole.findUnique({
      where: { id: input.projectRoleId },
      include: { applications: true, project: true },
    })
    if (!role) throw new NotFoundError('Rôle')
    if (role.project.status === 'ARCHIVE') throw new ValidationError('Ce CAP est archivé.')
    if (input.accept && role.holderId) throw new ValidationError('Ce rôle est déjà tenu.')

    if (!input.accept) {
      await tx.roleApplication.updateMany({
        where: { projectRoleId: role.id, userId: input.userId },
        data: { status: 'REFUSEE', decidedById: actor.id },
      })
      await notify(tx, input.userId, {
        type: 'CANDIDATURE_REFUSEE',
        message: `Ta candidature au rôle de ${role.name} n'a pas été retenue.`,
        link: '/roles',
      })
      return role
    }

    await tx.roleApplication.updateMany({
      where: { projectRoleId: role.id, userId: input.userId },
      data: { status: 'ACCEPTEE', decidedById: actor.id },
    })
    await tx.roleApplication.updateMany({
      where: { projectRoleId: role.id, userId: { not: input.userId }, status: 'EN_ATTENTE' },
      data: { status: 'REFUSEE', decidedById: actor.id },
    })

    const updated = await tx.projectRole.update({
      where: { id: role.id },
      data: { holderId: input.userId },
    })

    await notify(tx, input.userId, {
      type: 'ROLE_ATTRIBUE',
      message: `Tu es maintenant ${role.name} du CAP !`,
      link: '/roles',
    })
    const recales = role.applications.filter((a) => a.userId !== input.userId && a.status === 'EN_ATTENTE')
    await notifyMany(tx, recales.map((a) => a.userId), {
      type: 'CANDIDATURE_REFUSEE',
      message: `Le rôle de ${role.name} a été confié à quelqu'un d'autre.`,
      link: '/roles',
    })

    return updated
  })
}

export async function closeRole(db: PrismaClient, actor: Actor, projectRoleId: string) {
  if (!isChef(actor)) throw new ForbiddenError()

  const role = await db.projectRole.findUnique({ where: { id: projectRoleId }, include: { project: true } })
  if (!role) throw new NotFoundError('Rôle')
  if (role.project.status === 'ARCHIVE') throw new ValidationError('Ce CAP est archivé.')
  if (role.closedAt) throw new ValidationError('Ce rôle est déjà clôturé.')
  if (!role.holderId) throw new ValidationError('Ce rôle n\'a pas de titulaire.')

  const holderId = role.holderId

  await db.$transaction(async (tx) => {
    // Clôture conditionnelle : deux appels simultanés ne peuvent pas verser
    // les points deux fois, le second ne touche aucune ligne.
    const verrou = await tx.projectRole.updateMany({
      where: { id: role.id, closedAt: null },
      data: { closedAt: new Date() },
    })
    if (verrou.count === 0) throw new ValidationError('Ce rôle est déjà clôturé.')

    if (role.points > 0) {
      await creditPoints(tx, {
        userId: holderId,
        projectId: role.projectId,
        amount: role.points,
        reason: 'ROLE',
        projectRoleId: role.id,
      })
    }
  })

  const newBadges = await refreshBadges(db, holderId, role.projectId)

  await notify(db, holderId, {
    type: 'ROLE_CLOTURE',
    message: `Ton rôle de ${role.name} est terminé : ${role.points} points pour toi !`,
    link: '/profil',
  })

  return { awarded: role.points, newBadges }
}
