// src/lib/domain/points.ts
import { DIFFICULTIES, type Difficulty } from './types'

export type PointsScale = Record<Difficulty, number>

export const DEFAULT_SCALE: PointsScale = { FACILE: 10, MOYEN: 25, DIFFICILE: 50 }

export function maxBonus(difficulty: Difficulty, scale: PointsScale = DEFAULT_SCALE): number {
  return scale[difficulty]
}

/**
 * Points gagnés par CHAQUE participant d'une tâche validée.
 * Le socle est partagé, arrondi au supérieur ; le bonus s'applique à chacun.
 */
export function computeTaskAward(
  difficulty: Difficulty,
  participantCount: number,
  bonus: number,
  scale: PointsScale = DEFAULT_SCALE,
): number {
  if (!Number.isInteger(participantCount) || participantCount < 1) {
    throw new Error('Le nombre de participants doit être un entier supérieur ou égal à 1.')
  }
  if (!Number.isFinite(bonus) || bonus < 0) {
    throw new Error('Le bonus ne peut pas être négatif.')
  }

  const base = scale[difficulty]
  const share = Math.ceil(base / participantCount)
  return share + Math.min(Math.round(bonus), maxBonus(difficulty, scale))
}

export function parseScale(raw: string | null | undefined): PointsScale {
  if (!raw) return DEFAULT_SCALE
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SCALE
    const candidate = parsed as Record<string, unknown>
    const complete = DIFFICULTIES.every(
      (d) => typeof candidate[d] === 'number' && Number.isInteger(candidate[d]) && (candidate[d] as number) > 0,
    )
    if (!complete) return DEFAULT_SCALE
    return {
      FACILE: candidate.FACILE as number,
      MOYEN: candidate.MOYEN as number,
      DIFFICILE: candidate.DIFFICILE as number,
    }
  } catch {
    return DEFAULT_SCALE
  }
}
