// src/lib/domain/badges.ts
import type { Phase } from './types'

export const BADGE_RULE_TYPES = [
  'TACHES_VALIDEES',
  'TACHE_DIFFICILE',
  'TACHES_EN_EQUIPE',
  'TOUTES_PHASES',
  'SERIE_SANS_REFUS',
  'ROLE_CLOTURE',
  'SOUMISSIONS_AVEC_PHOTO',
] as const
export type BadgeRuleType = (typeof BADGE_RULE_TYPES)[number]

export interface BadgeRule {
  code: string
  ruleType: BadgeRuleType
  threshold: number
}

export interface UserStats {
  validatedTaskCount: number
  hardValidatedTaskCount: number
  /** Tâches validées comptant au moins deux participants. */
  teamValidatedTaskCount: number
  /** Phases couvertes par des tâches validées, projet par projet. */
  phasesByProject: Record<string, Phase[]>
  /** Validations consécutives sans aucun refus intercalé. */
  cleanStreak: number
  closedRoleCount: number
  photoSubmissionCount: number
}

export function emptyStats(): UserStats {
  return {
    validatedTaskCount: 0,
    hardValidatedTaskCount: 0,
    teamValidatedTaskCount: 0,
    phasesByProject: {},
    cleanStreak: 0,
    closedRoleCount: 0,
    photoSubmissionCount: 0,
  }
}

/** Valeur mesurée pour une règle, à comparer à son seuil. */
export function measure(ruleType: BadgeRuleType, stats: UserStats): number {
  switch (ruleType) {
    case 'TACHES_VALIDEES':
      return stats.validatedTaskCount
    case 'TACHE_DIFFICILE':
      return stats.hardValidatedTaskCount
    case 'TACHES_EN_EQUIPE':
      return stats.teamValidatedTaskCount
    case 'TOUTES_PHASES':
      return Math.max(0, ...Object.values(stats.phasesByProject).map((p) => new Set(p).size))
    case 'SERIE_SANS_REFUS':
      return stats.cleanStreak
    case 'ROLE_CLOTURE':
      return stats.closedRoleCount
    case 'SOUMISSIONS_AVEC_PHOTO':
      return stats.photoSubmissionCount
    default:
      return 0
  }
}

/** Codes des badges mérités et pas encore obtenus, dans l'ordre des règles reçues. */
export function evaluateBadges(rules: BadgeRule[], stats: UserStats, earnedCodes: string[]): string[] {
  const earned = new Set(earnedCodes)
  return rules
    .filter((rule) => !earned.has(rule.code))
    .filter((rule) => BADGE_RULE_TYPES.includes(rule.ruleType) && measure(rule.ruleType, stats) >= rule.threshold)
    .map((rule) => rule.code)
}
