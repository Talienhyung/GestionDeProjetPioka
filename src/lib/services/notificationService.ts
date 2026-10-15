import type { Db } from '@/lib/db'

export interface NotificationInput {
  type: string
  message: string
  link: string
}

export async function notify(db: Db, userId: string, input: NotificationInput): Promise<void> {
  await db.notification.create({ data: { userId, ...input } })
}

export async function notifyMany(db: Db, userIds: string[], input: NotificationInput): Promise<void> {
  if (userIds.length === 0) return
  await db.notification.createMany({ data: userIds.map((userId) => ({ userId, ...input })) })
}

export async function countUnread(db: Db, userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } })
}

export async function listNotifications(db: Db, userId: string, limit = 50) {
  return db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit })
}

export async function markAllRead(db: Db, userId: string): Promise<void> {
  await db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } })
}
