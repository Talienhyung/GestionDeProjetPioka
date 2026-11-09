'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icone, type NomIcone } from '@/components/Icone'
import { Picto } from '@/components/sgdf/Picto'
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
 * Deux entrées de chaque côté, l'accueil au centre sous la tente. Ce qui sert
 * moins souvent (pilotage, comptes, membres, paramètres) est sur le Profil.
 */
export function NavBar({ isChef, unread }: Props) {
  const chemin = usePathname()
  const actif = (href: string) => chemin === href || chemin.startsWith(`${href}/`)

  const gauche: Entree[] = [
    { href: '/cap', label: 'Nos CAP', icone: 'boussole' },
    { href: '/tableau', label: 'Tableau', icone: 'fanion' },
  ]
  const droite: Entree[] = [
    isChef
      ? { href: '/validation', label: 'Valider', icone: 'coche' }
      : { href: '/agenda', label: 'Agenda', icone: 'calendrier' },
    { href: '/profil', label: 'Profil', icone: 'personne' },
  ]

  const lien = (entree: Entree) => (
    <li key={entree.href} className="flex-1">
      <Link
        href={entree.href}
        aria-current={actif(entree.href) ? 'page' : undefined}
        className={`flex flex-col items-center gap-1 px-1 pt-2.5 pb-2 transition-colors ${
          actif(entree.href) ? 'text-accent' : 'text-encre-douce hover:text-encre'
        }`}
      >
        <Icone nom={entree.icone} taille={22} />
        <span className="panneau text-[10px] leading-none">{entree.label}</span>
      </Link>
    </li>
  )

  const accueilActif = actif('/accueil')

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-trait bg-carte/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-3xl items-stretch">
        {gauche.map(lien)}

        <li className="relative flex flex-1 justify-center">
          <Link
            href="/accueil"
            aria-label="Accueil"
            aria-current={accueilActif ? 'page' : undefined}
            className={`absolute -top-6 grid size-16 place-items-center rounded-full border-4 border-surface shadow-lg transition-transform hover:scale-105 ${
              accueilActif ? 'bg-accent text-sur-accent' : 'bg-institution text-sur-institution'
            }`}
          >
            <Picto nom="tente" taille={34} />
            {unread > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full border-2 border-carte bg-choisir px-1 text-[10px] font-bold tabular-nums text-encre">
                {unread}
              </span>
            ) : null}
          </Link>
        </li>

        {droite.map(lien)}
      </ul>
    </nav>
  )
}
