import { Picto } from '@/components/sgdf/Picto'
import type { NomPicto } from '@/components/sgdf/pictos'

export type NomIcone =
  | 'maison'
  | 'boussole'
  | 'ecusson'
  | 'trophee'
  | 'coche'
  | 'personne'
  | 'groupe'
  | 'cloche'
  | 'chevron'
  | 'fanion'
  | 'reglages'
  | 'calendrier'

/** Chaque icône du site renvoie à un pictogramme officiel SGDF. */
const PICTO_DE: Record<Exclude<NomIcone, 'chevron'>, NomPicto> = {
  maison: 'maison',
  boussole: 'boussole',
  ecusson: 'promesse',
  trophee: 'coupe',
  coche: 'coche',
  personne: 'visage',
  groupe: 'equipe',
  cloche: 'cloche',
  fanion: 'drapeau',
  reglages: 'engrenage',
  calendrier: 'calendrier',
}

interface Props {
  nom: NomIcone
  className?: string
  /** Taille en pixels ; 22 convient à la barre de navigation. */
  taille?: number
}

/**
 * Icônes du site : pictogrammes SGDF. Seul le chevron reste un simple trait,
 * c'est un signe d'interface et la charte n'en propose pas.
 */
export function Icone({ nom, className = '', taille = 22 }: Props) {
  if (nom === 'chevron') {
    return (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        width={taille}
        height={taille}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="m9 5 7 7-7 7" />
      </svg>
    )
  }
  return <Picto nom={PICTO_DE[nom]} taille={taille} className={className} />
}
