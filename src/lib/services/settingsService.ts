import type { Db } from '@/lib/db'
import { DEFAULT_SCALE, type PointsScale, parseScale } from '@/lib/domain/points'

const SCALE_KEY = 'pointsScale'

export async function getScale(db: Db): Promise<PointsScale> {
  const setting = await db.setting.findUnique({ where: { key: SCALE_KEY } })
  return parseScale(setting?.value)
}

export async function setScale(db: Db, scale: PointsScale): Promise<void> {
  const value = JSON.stringify(scale)
  await db.setting.upsert({ where: { key: SCALE_KEY }, update: { value }, create: { key: SCALE_KEY, value } })
}

export { DEFAULT_SCALE }
