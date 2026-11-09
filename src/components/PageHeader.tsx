import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icone } from '@/components/Icone'
import { Picto } from '@/components/sgdf/Picto'
import type { NomPicto } from '@/components/sgdf/pictos'

interface Props {
  titre: ReactNode
  /** Petite ligne en capitales au-dessus du titre (rubrique). */
  surtitre?: string
  /** Une phrase d'explication sous le titre. */
  description?: ReactNode
  /** Pictogramme SGDF de la page, dans une pastille. */
  picto?: NomPicto
  /** Lien de retour, affiché au-dessus. */
  retour?: { href: string; label: string }
  /** Bouton ou lien à droite du titre. */
  action?: ReactNode
  /** Contenu ajouté sous la description (pastilles d'état…). */
  children?: ReactNode
}

/**
 * En-tête commun à toutes les pages : même place, même typographie, même
 * pastille. Le titre au pinceau de la charte, souligné d'un trait de feutre.
 */
export function PageHeader({ titre, surtitre, description, picto, retour, action, children }: Props) {
  return (
    <header className="flex flex-col gap-2 pt-1">
      {retour ? (
        <Link
          href={retour.href}
          className="panneau -mb-0.5 inline-flex w-fit items-center gap-1 text-[11px] text-encre-douce hover:text-encre"
        >
          <Icone nom="chevron" taille={14} className="rotate-180" />
          {retour.label}
        </Link>
      ) : null}

      <div className="flex items-center gap-3">
        {picto ? (
          <span className="grid size-12 shrink-0 -rotate-3 place-items-center rounded-2xl bg-accent text-sur-accent shadow-[0_3px_0_var(--accent-encre)]">
            <Picto nom={picto} taille={28} />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          {surtitre ? <p className="panneau text-[10px] text-encre-douce">{surtitre}</p> : null}
          <h1 className="titre-page brush text-[2.4rem] leading-[1.05] text-encre">{titre}</h1>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {description ? <p className="text-sm leading-snug text-encre-douce">{description}</p> : null}
      {children}
    </header>
  )
}
