// src/lib/services/parcoursService.ts
import type { Db } from '@/lib/db'
import { type DonneesParcours, type Etape, construireParcours } from '@/lib/domain/parcours'
import type { Actor } from '@/lib/domain/types'
import { listEvents, listUpcomingEvents } from './eventService'

/** Rassemble tout ce qu'un jeune a vécu dans la caravane, puis le met en route. */
export async function getParcours(db: Db, actor: Actor, maintenant = new Date()): Promise<Etape[]> {
  const userId = actor.id
  const [user, evenements, prochains, assignations, roles, badges, boulots, points] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    // Les activités qu'il pouvait voir dans l'agenda, depuis toujours jusqu'à maintenant.
    listEvents(db, actor, new Date(0), maintenant),
    listUpcomingEvents(db, actor, 1, maintenant),
    db.taskAssignment.findMany({
      where: { userId, task: { status: 'TERMINEE' } },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            projectId: true,
            project: { select: { title: true } },
            submissions: {
              where: { decision: 'ACCEPTEE' },
              orderBy: { reviewedAt: 'desc' },
              take: 1,
              select: { reviewedAt: true },
            },
          },
        },
      },
    }),
    db.projectRole.findMany({
      where: { holderId: userId, closedAt: { not: null } },
      select: { id: true, name: true, closedAt: true, project: { select: { title: true } } },
    }),
    db.userBadge.findMany({
      where: { userId },
      select: { earnedAt: true, badge: { select: { id: true, name: true, description: true } } },
    }),
    db.extraJobWorker.findMany({
      where: { userId },
      select: { extraJob: { select: { id: true, title: true, doneOn: true } } },
    }),
    db.pointsEntry.findMany({
      where: { userId },
      select: { amount: true, reason: true, createdAt: true, taskId: true, projectRoleId: true, badgeId: true },
    }),
  ])

  // Date de validation d'une tâche : la décision du chef, sinon le crédit des points.
  const creditTache = new Map<string, Date>()
  for (const p of points) {
    if (p.reason === 'TACHE' && p.taskId && !creditTache.has(p.taskId)) creditTache.set(p.taskId, p.createdAt)
  }

  const donnees: DonneesParcours = {
    arrivee: user?.createdAt ?? maintenant,
    activites: evenements.map((e) => ({
      id: e.id,
      title: e.title,
      location: e.location,
      description: e.description,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
    })),
    aVenir: prochains[0]
      ? {
          id: prochains[0].id,
          title: prochains[0].title,
          location: prochains[0].location,
          description: prochains[0].description,
          startsAt: prochains[0].startsAt,
        }
      : null,
    taches: assignations.map(({ task }) => ({
      id: task.id,
      projectId: task.projectId,
      title: task.title,
      projectTitle: task.project.title,
      validatedAt: task.submissions[0]?.reviewedAt ?? creditTache.get(task.id) ?? maintenant,
    })),
    roles: roles.map((r) => ({
      id: r.id,
      name: r.name,
      projectTitle: r.project.title,
      closedAt: r.closedAt as Date,
    })),
    badges: badges.map((b) => ({
      id: b.badge.id,
      name: b.badge.name,
      description: b.badge.description,
      earnedAt: b.earnedAt,
    })),
    boulots: boulots.map((b) => b.extraJob),
    points,
  }

  return construireParcours(donnees, maintenant)
}
