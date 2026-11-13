import type { Db } from '@/lib/db'
import { type BadgeRule, type UserStats, emptyStats, evaluateBadges } from '@/lib/domain/badges'
import type { BadgeRuleType } from '@/lib/domain/badges'
import type { Phase } from '@/lib/domain/types'
import { notify } from './notificationService'
import { creditPoints } from './pointsService'

export async function collectStats(db: Db, userId: string): Promise<UserStats> {
  const [assignments, closedRoleCount, photoSubmissionCount, reviewed] = await Promise.all([
    db.taskAssignment.findMany({
      where: { userId, task: { status: 'TERMINEE' } },
      include: { task: { include: { _count: { select: { assignments: true } } } } },
    }),
    db.projectRole.count({ where: { holderId: userId, closedAt: { not: null } } }),
    db.submission.count({ where: { submittedById: userId, attachments: { some: {} } } }),
    db.submission.findMany({
      where: { decision: { not: null }, task: { assignments: { some: { userId } } } },
      orderBy: { reviewedAt: 'desc' },
      select: { decision: true },
    }),
  ])

  const stats = emptyStats()
  stats.validatedTaskCount = assignments.length

  for (const { task } of assignments) {
    if (task.difficulty === 'DIFFICILE') stats.hardValidatedTaskCount += 1
    if (task._count.assignments >= 2) stats.teamValidatedTaskCount += 1
    const phases = stats.phasesByProject[task.projectId] ?? []
    phases.push(task.phase as Phase)
    stats.phasesByProject[task.projectId] = phases
  }

  for (const submission of reviewed) {
    if (submission.decision !== 'ACCEPTEE') break
    stats.cleanStreak += 1
  }

  stats.closedRoleCount = closedRoleCount
  stats.photoSubmissionCount = photoSubmissionCount
  return stats
}

/** Évalue les badges du jeune, enregistre les nouveaux, crédite leurs points et le prévient. */
export async function refreshBadges(db: Db, userId: string, projectId: string): Promise<string[]> {
  const [badges, earned, stats] = await Promise.all([
    db.badge.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.userBadge.findMany({ where: { userId }, include: { badge: { select: { code: true } } } }),
    collectStats(db, userId),
  ])

  const rules: BadgeRule[] = badges.map((b) => ({
    code: b.code,
    ruleType: b.ruleType as BadgeRuleType,
    threshold: b.threshold,
  }))

  const codes = evaluateBadges(rules, stats, earned.map((e) => e.badge.code))

  for (const code of codes) {
    const badge = badges.find((b) => b.code === code)!
    await db.userBadge.create({ data: { userId, badgeId: badge.id, projectId } })
    if (badge.points > 0) {
      await creditPoints(db, {
        userId,
        projectId,
        amount: badge.points,
        reason: 'BADGE',
        badgeId: badge.id,
      })
    }
    await notify(db, userId, {
      type: 'BADGE',
      message: `Badge débloqué : ${badge.name}`,
      link: '/profil',
    })
  }

  return codes
}
