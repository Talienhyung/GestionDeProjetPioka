// src/lib/domain/stretchGoals.ts

/** Palier de récolte : un fanion posé sur la barre des récoltes. */
export interface StretchGoal {
  amountCents: number
  label: string
}

export const GOAL_LABEL_MAX = 40
export const GOALS_MAX = 8

export interface GoalMarker extends StretchGoal {
  /** Position du fanion sur la barre, de 0 à 100. */
  percent: number
  reached: boolean
}

export interface StretchProgress {
  /** Remplissage de la barre, de 0 à 100. */
  percent: number
  markers: GoalMarker[]
  /** Premier palier pas encore atteint, null si tout est atteint. */
  next: StretchGoal | null
  /** Ce qu'il manque pour atteindre le prochain palier, en centimes. */
  remainingCents: number
  reachedCount: number
}

/** Tri par montant, sans doublon de montant ni palier invalide. */
export function normalizeGoals(goals: StretchGoal[]): StretchGoal[] {
  const seen = new Set<number>()
  return goals
    .filter((g) => Number.isInteger(g.amountCents) && g.amountCents > 0 && typeof g.label === 'string')
    .map((g) => ({ amountCents: g.amountCents, label: g.label.trim().slice(0, GOAL_LABEL_MAX) }))
    .sort((a, b) => a.amountCents - b.amountCents)
    .filter((g) => (seen.has(g.amountCents) ? false : (seen.add(g.amountCents), true)))
}

export function parseStretchGoals(raw: string | null | undefined): StretchGoal[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return normalizeGoals(parsed as StretchGoal[])
  } catch {
    return []
  }
}

/**
 * La barre va jusqu'au dernier palier ; au-delà, elle reste pleine.
 * Sans palier, il n'y a pas d'échelle : la barre est vide.
 */
export function stretchProgress(collectedCents: number, goals: StretchGoal[]): StretchProgress {
  const sorted = normalizeGoals(goals)
  const collected = Math.max(0, collectedCents)
  const top = sorted.at(-1)?.amountCents ?? 0

  const markers = sorted.map((g) => ({
    ...g,
    percent: top > 0 ? (g.amountCents / top) * 100 : 0,
    reached: collected >= g.amountCents,
  }))
  const next = sorted.find((g) => collected < g.amountCents) ?? null

  return {
    percent: top > 0 ? Math.min(100, (collected / top) * 100) : 0,
    markers,
    next,
    remainingCents: next ? next.amountCents - collected : 0,
    reachedCount: markers.filter((m) => m.reached).length,
  }
}
