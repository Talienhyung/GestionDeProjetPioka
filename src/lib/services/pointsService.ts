import { Prisma } from '@prisma/client'
import type { Db } from '@/lib/db'
import type { PointsReason } from '@/lib/domain/types'

export interface PointsInput {
  userId: string
  projectId: string
  amount: number
  reason: PointsReason
  taskId?: string
  submissionId?: string
  projectRoleId?: string
  badgeId?: string
}

export interface LedgerLine {
  id: string
  amount: number
  reason: string
  createdAt: Date
  taskTitle: string | null
}

export interface LeaderboardRow {
  userId: string
  displayName: string
  points: number
  badgeCount: number
}

export class DuplicateAwardError extends Error {
  constructor() {
    super('Ces points ont déjà été attribués pour cette soumission.')
    this.name = 'DuplicateAwardError'
  }
}

export async function creditPoints(db: Db, input: PointsInput): Promise<void> {
  try {
    await db.pointsEntry.create({ data: input })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new DuplicateAwardError()
    }
    throw error
  }
}

export async function getScore(db: Db, userId: string, projectId?: string): Promise<number> {
  const result = await db.pointsEntry.aggregate({
    where: { userId, ...(projectId ? { projectId } : {}) },
    _sum: { amount: true },
  })
  return result._sum.amount ?? 0
}

export async function getLedger(db: Db, userId: string, projectId?: string): Promise<LedgerLine[]> {
  const rows = await db.pointsEntry.findMany({
    where: { userId, ...(projectId ? { projectId } : {}) },
    orderBy: { createdAt: 'desc' },
    include: { task: { select: { title: true } } },
  })
  return rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    reason: row.reason,
    createdAt: row.createdAt,
    taskTitle: row.task?.title ?? null,
  }))
}

export async function getLeaderboard(db: Db, projectId: string): Promise<LeaderboardRow[]> {
  const [sums, jeunes, badges] = await Promise.all([
    db.pointsEntry.groupBy({ by: ['userId'], where: { projectId }, _sum: { amount: true } }),
    db.user.findMany({ where: { role: 'JEUNE', isActive: true }, select: { id: true, displayName: true } }),
    db.userBadge.groupBy({ by: ['userId'], _count: { _all: true } }),
  ])

  const pointsByUser = new Map(sums.map((s) => [s.userId, s._sum.amount ?? 0]))
  const badgesByUser = new Map(badges.map((b) => [b.userId, b._count._all]))

  return jeunes
    .map((jeune) => ({
      userId: jeune.id,
      displayName: jeune.displayName,
      points: pointsByUser.get(jeune.id) ?? 0,
      badgeCount: badgesByUser.get(jeune.id) ?? 0,
    }))
    .sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName, 'fr'))
}
