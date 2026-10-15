import Link from 'next/link'
import type { AppRole } from '@/lib/domain/types'

interface Props {
  role: AppRole
  isChef: boolean
  unread: number
}

export function NavBar({ role, isChef, unread }: Props) {
  const links = [
    { href: '/accueil', label: 'Accueil', emoji: '🏠' },
    { href: '/cap', label: 'Le CAP', emoji: '🗺️' },
    { href: '/roles', label: 'Rôles', emoji: '🎖️' },
    { href: '/classement', label: 'Classement', emoji: '🏆' },
    ...(isChef ? [{ href: '/validation', label: 'Valider', emoji: '✅' }] : []),
    ...(role === 'SUPER_ADMIN' ? [{ href: '/comptes', label: 'Comptes', emoji: '👥' }] : []),
    { href: '/profil', label: 'Profil', emoji: '🙂' },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 border-t bg-white/95 backdrop-blur dark:bg-stone-900/95">
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around">
        {links.map((link) => (
          <li key={link.href} className="flex-1">
            <Link href={link.href} className="flex flex-col items-center gap-0.5 p-2 text-[11px]">
              <span className="relative text-xl" aria-hidden>
                {link.emoji}
                {link.href === '/accueil' && unread > 0 ? (
                  <span className="absolute -right-2 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                ) : null}
              </span>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
