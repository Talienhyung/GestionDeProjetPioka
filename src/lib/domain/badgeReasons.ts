// src/lib/domain/badgeReasons.ts
import type { BadgeRuleType } from './badges'

const pluriel = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un)

/** Pourquoi un badge a été gagné, dit au jeune, d'après sa règle. */
export function badgeReason(ruleType: string, threshold: number): string {
  const n = threshold
  switch (ruleType as BadgeRuleType) {
    case 'TACHES_VALIDEES':
      return n <= 1
        ? 'Ta toute première tâche a été validée par un chef.'
        : `Tu as fait valider ${n} tâches.`
    case 'TACHE_DIFFICILE':
      return n <= 1
        ? 'Tu as mené une tâche difficile jusqu’au bout.'
        : `Tu as mené ${n} tâches difficiles jusqu’au bout.`
    case 'TACHES_EN_EQUIPE':
      return `Tu as réalisé ${n} ${pluriel(n, 'tâche', 'tâches')} à plusieurs, validée${n > 1 ? 's' : ''}.`
    case 'TOUTES_PHASES':
      return 'Tu as une tâche validée dans chacune des étapes d’un même CAP : Choisir, Agir et Partager.'
    case 'SERIE_SANS_REFUS':
      return `${n} de tes rendus ont été validés d’affilée, sans aucun retour à corriger.`
    case 'ROLE_CLOTURE':
      return n <= 1 ? 'Tu as tenu un rôle du CAP jusqu’au bout.' : `Tu as tenu ${n} rôles jusqu’au bout.`
    case 'SOUMISSIONS_AVEC_PHOTO':
      return `Tu as rendu ${n} ${pluriel(n, 'travail', 'travaux')} avec une photo.`
    default:
      return 'Tu as rempli la condition de ce badge.'
  }
}
