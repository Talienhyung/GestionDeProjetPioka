// src/components/sgdf/PictoMasque.tsx
import type { CSSProperties } from 'react'

interface Props {
  /** Clé du catalogue (public/pictos/<clé>.svg). */
  cle: string
  taille?: number
  className?: string
  titre?: string
}

/**
 * Un pictogramme du catalogue SGDF, peint dans la couleur du texte. Servi en
 * fichier statique (mis en cache) plutôt que dans le JavaScript : les 200
 * pictos du sélecteur ne coûtent rien tant qu'on ne les affiche pas.
 */
export function PictoMasque({ cle, taille = 28, className = '', titre }: Props) {
  const style = { width: taille, height: taille, '--picto': `url(/pictos/${cle}.svg)` } as CSSProperties
  return (
    <span
      className={`picto-masque ${className}`}
      style={style}
      role={titre ? 'img' : undefined}
      aria-label={titre}
      aria-hidden={titre ? undefined : true}
    />
  )
}
