// src/lib/ui/reglesBadges.ts
import type { BadgeRuleType } from '@/lib/domain/badges'

/** Les conditions d'obtention, dites simplement, pour le formulaire admin. */
export const REGLES: Record<BadgeRuleType, { label: string; seuil: string; seuilFixe?: number }> = {
  TACHES_VALIDEES: { label: 'Tâches validées', seuil: 'Nombre de tâches validées' },
  TACHE_DIFFICILE: { label: 'Tâches difficiles validées', seuil: 'Nombre de tâches difficiles' },
  TACHES_EN_EQUIPE: { label: 'Tâches validées à plusieurs', seuil: 'Nombre de tâches à plusieurs' },
  TOUTES_PHASES: { label: 'Les trois étapes d’un même CAP', seuil: 'Étapes couvertes', seuilFixe: 3 },
  SERIE_SANS_REFUS: { label: 'Rendus validés d’affilée, sans refus', seuil: 'Longueur de la série' },
  ROLE_CLOTURE: { label: 'Rôles tenus jusqu’au bout', seuil: 'Nombre de rôles' },
  SOUMISSIONS_AVEC_PHOTO: { label: 'Rendus avec une photo', seuil: 'Nombre de rendus avec photo' },
}

export function resumeRegle(ruleType: string, threshold: number): string {
  const regle = REGLES[ruleType as BadgeRuleType]
  if (!regle) return 'Condition inconnue'
  return regle.seuilFixe ? regle.label : `${regle.label} : ${threshold}`
}
