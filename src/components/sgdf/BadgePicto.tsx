import { Picto } from '@/components/sgdf/Picto'
import type { NomPicto } from '@/components/sgdf/pictos'

/** Pictogramme SGDF de chaque badge du catalogue, par code. */
const PICTO_BADGE: Record<string, NomPicto> = {
  premier_pas: 'graine',
  bosseur_1: 'feu',
  bosseur_2: 'trek',
  bosseur_3: 'coupe',
  costaud: 'montagne',
  equipe: 'equipe',
  debut_fin: 'boussole',
  sans_faute: 'etoile',
  responsable: 'promesse',
  photographe: 'photo',
}

/** Couleurs de la charte, tournantes, pour que l'étagère ait l'air d'un foulard d'écussons. */
const TEINTES = [
  'bg-accent text-sur-accent',
  'bg-institution text-sur-institution',
  'bg-agir text-white',
  'bg-choisir text-encre',
  'bg-partager text-white',
]

export function teinteBadge(index: number) {
  return TEINTES[index % TEINTES.length]
}

interface Props {
  code: string
  /** Emoji enregistré en base : utilisé pour un badge sans picto attitré. */
  icon: string
  taille?: number
  className?: string
}

export function BadgePicto({ code, icon, taille = 28, className = '' }: Props) {
  const nom = PICTO_BADGE[code]
  if (!nom) {
    return (
      <span aria-hidden className={className} style={{ fontSize: taille * 0.9, lineHeight: 1 }}>
        {icon}
      </span>
    )
  }
  return <Picto nom={nom} taille={taille} className={className} />
}
