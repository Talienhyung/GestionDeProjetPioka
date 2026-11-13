// src/components/Ecusson.tsx
import type { CSSProperties } from 'react'
import { PictoMasque } from '@/components/sgdf/PictoMasque'
import { COULEUR_DEFAUT, clampNiveau, couleurSurFond, niveauRomain, normaliserCouleur } from '@/lib/domain/badgeLook'

export interface ApparenceBadge {
  pictoKey: string | null
  /** Adresse de l'image envoyée, prioritaire sur le picto. */
  imageUrl: string | null
  color: string
  level: number
}

interface Props extends ApparenceBadge {
  taille?: number
  /** Afficher le ruban du niveau (I à V). */
  ruban?: boolean
  className?: string
}

/**
 * Le dessin d'un écusson : un disque de couleur cousu, un picto SGDF ou une
 * image, et une bordure qui s'enrichit avec le niveau (bronze, argent, or,
 * légendaire). Sans état : utilisable côté serveur comme dans un formulaire.
 */
export function Ecusson({ pictoKey, imageUrl, color, level, taille = 80, ruban = true, className = '' }: Props) {
  const niveau = clampNiveau(level)
  const fond = normaliserCouleur(color) ?? COULEUR_DEFAUT
  const style = { '--s': `${taille}px`, '--fond': fond, '--encre': couleurSurFond(fond) } as CSSProperties

  return (
    <span className={`ecusson ecusson-n${niveau} ${className}`} style={style}>
      <span className="ecusson-coeur">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- image privée servie par l'API, après session
          <img src={imageUrl} alt="" draggable={false} />
        ) : pictoKey ? (
          <PictoMasque cle={pictoKey} taille={Math.round(taille * (niveau >= 4 ? 0.42 : 0.5))} />
        ) : null}
      </span>
      {ruban ? <span className="ecusson-ruban">{niveauRomain(niveau)}</span> : null}
    </span>
  )
}
