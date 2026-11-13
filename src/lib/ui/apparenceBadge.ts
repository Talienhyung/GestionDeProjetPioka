// src/lib/ui/apparenceBadge.ts
import type { ApparenceBadge } from '@/components/Ecusson'
import { COULEURS_CHARTE } from '@/lib/domain/badgeLook'

/** Pictos des badges d'origine, s'ils n'ont pas encore été personnalisés. */
const PICTO_PAR_CODE: Record<string, string> = {
  premier_pas: 'graine',
  bosseur_1: 'flamme',
  bosseur_2: 'trek',
  bosseur_3: 'coupe',
  costaud: 'montagne',
  equipe: 'tribu',
  debut_fin: 'boussole',
  sans_faute: 'etoile',
  responsable: 'promesse',
  photographe: 'appareil_photo',
}

interface BadgeEnBase {
  id: string
  code: string
  sortOrder: number
  pictoKey: string | null
  imageName: string | null
  color: string | null
  level: number
}

export function imageBadgeUrl(badge: { id: string; imageName: string | null }): string | null {
  // Le nom du fichier sert de version : une nouvelle image contourne le cache.
  return badge.imageName ? `/api/badges/${badge.id}/image?v=${badge.imageName.slice(0, 10)}` : null
}

/** Ce qu'il faut pour dessiner l'écusson d'un badge, valeurs par défaut comprises. */
export function apparenceBadge(badge: BadgeEnBase): ApparenceBadge {
  return {
    pictoKey: badge.pictoKey ?? PICTO_PAR_CODE[badge.code] ?? 'etoile',
    imageUrl: imageBadgeUrl(badge),
    color: badge.color ?? COULEURS_CHARTE[Math.abs(badge.sortOrder) % COULEURS_CHARTE.length],
    level: badge.level,
  }
}

export function couvertureUrl(projet: { id: string; coverName: string | null }): string | null {
  return projet.coverName ? `/api/cap/${projet.id}/couverture?v=${projet.coverName.slice(0, 10)}` : null
}
