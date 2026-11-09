import type { Db } from '@/lib/db'
import { DEFAULT_SCALE, type PointsScale, parseScale } from '@/lib/domain/points'
import { type StretchGoal, normalizeGoals, parseStretchGoals } from '@/lib/domain/stretchGoals'

const SCALE_KEY = 'pointsScale'
const STRETCH_GOALS_KEY = 'stretchGoals'

export async function getScale(db: Db): Promise<PointsScale> {
  const setting = await db.setting.findUnique({ where: { key: SCALE_KEY } })
  return parseScale(setting?.value)
}

export async function setScale(db: Db, scale: PointsScale): Promise<void> {
  const value = JSON.stringify(scale)
  await db.setting.upsert({ where: { key: SCALE_KEY }, update: { value }, create: { key: SCALE_KEY, value } })
}

/** Paliers de la barre des récoltes, triés par montant. */
export async function getStretchGoals(db: Db): Promise<StretchGoal[]> {
  const setting = await db.setting.findUnique({ where: { key: STRETCH_GOALS_KEY } })
  return parseStretchGoals(setting?.value)
}

export async function setStretchGoals(db: Db, goals: StretchGoal[]): Promise<void> {
  const value = JSON.stringify(normalizeGoals(goals))
  await db.setting.upsert({
    where: { key: STRETCH_GOALS_KEY },
    update: { value },
    create: { key: STRETCH_GOALS_KEY, value },
  })
}

export { DEFAULT_SCALE }
