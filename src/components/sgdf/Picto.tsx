import { PICTOS, type NomPicto } from '@/components/sgdf/pictos'

interface Props {
  nom: NomPicto
  /** Taille en pixels. */
  taille?: number
  className?: string
  /** Texte pour les lecteurs d'écran ; sans titre, le picto est décoratif. */
  titre?: string
}

/** Pictogramme officiel SGDF, coloré par la couleur du texte (currentColor). */
export function Picto({ nom, taille = 24, className = '', titre }: Props) {
  const { viewBox, svg } = PICTOS[nom]
  return (
    <svg
      viewBox={viewBox}
      width={taille}
      height={taille}
      fill="currentColor"
      className={`shrink-0 ${className}`}
      role={titre ? 'img' : undefined}
      aria-label={titre}
      aria-hidden={titre ? undefined : true}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
