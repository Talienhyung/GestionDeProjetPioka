'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ONGLETS = [
  { label: 'Tâches', chemin: '', aussi: ['/tache/', '/taches'] },
  { label: 'Rôles', chemin: '/roles', aussi: [] },
  { label: 'Billets', chemin: '/billets', aussi: [] },
  { label: 'Classement', chemin: '/classement', aussi: [] },
]

/**
 * Onglets d'un CAP, collés en haut de l'écran pendant qu'on fait défiler :
 * on sait toujours dans quelle partie du CAP on se trouve.
 */
export function OngletsProjet({ projectId }: { projectId: string }) {
  const chemin = usePathname()
  const racine = `/cap/${projectId}`

  const actif = (o: (typeof ONGLETS)[number]) =>
    o.chemin === ''
      ? chemin === racine || o.aussi.some((a) => chemin.startsWith(racine + a))
      : chemin.startsWith(racine + o.chemin)

  return (
    <nav
      aria-label="Parties du CAP"
      className="sticky top-0 z-10 -mx-4 border-b border-trait bg-surface/95 px-4 backdrop-blur"
    >
      <ul className="flex">
        {ONGLETS.map((o) => {
          const on = actif(o)
          return (
            <li key={o.label} className="flex-1">
              <Link
                href={racine + o.chemin}
                aria-current={on ? 'page' : undefined}
                className={`panneau relative block py-3 text-center text-[11px] transition-colors ${
                  on ? 'text-accent' : 'text-encre-douce hover:text-encre'
                }`}
              >
                {o.label}
                <span
                  aria-hidden
                  className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full transition-colors ${
                    on ? 'bg-accent' : 'bg-transparent'
                  }`}
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
