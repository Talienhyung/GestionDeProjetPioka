import Link from 'next/link'
import { Icone, type NomIcone } from '@/components/Icone'
import type { AppRole } from '@/lib/domain/types'

interface Props {
  role: AppRole
  isChef: boolean
  unread: number
}

interface Entree {
  href: string
  label: string
  icone: NomIcone
}

/**
 * Cinq entrées au maximum : au-delà, les libellés se chevauchent sur un
 * téléphone. Ce qui sert moins souvent (pilotage, comptes, membres,
 * paramètres, archives) est regroupé sur la page Profil.
 */
export function NavBar({ isChef, unread }: Props) {
  // Rôles et classement appartiennent à un CAP : on y accède depuis sa page.
  const entrees: Entree[] = [
    { href: '/accueil', label: 'Accueil', icone: 'maison' },
    { href: '/cap', label: 'Nos CAP', icone: 'boussole' },
    ...(isChef ? [{ href: '/validation', label: 'Valider', icone: 'coche' as NomIcone }] : []),
    { href: '/profil', label: 'Profil', icone: 'personne' },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-trait bg-carte/95 backdrop-blur">
      <ul className="mx-auto flex max-w-3xl items-stretch">
        {entrees.map((entree) => (
          <li key={entree.href} className="flex-1">
            <Link
              href={entree.href}
              className="flex flex-col items-center gap-1 px-1 py-2 text-encre-douce transition-colors hover:text-accent"
            >
              <span className="relative">
                <Icone nom={entree.icone} />
                {entree.href === '/accueil' && unread > 0 ? (
                  <span className="absolute -right-2.5 -top-1 rounded-full bg-accent px-1.5 text-[10px] font-bold tabular-nums text-sur-accent">
                    {unread}
                  </span>
                ) : null}
              </span>
              <span className="panneau text-[11px] leading-none">{entree.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
