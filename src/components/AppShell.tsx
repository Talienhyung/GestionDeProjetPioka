import type { ReactNode } from 'react'
import { NavBar } from '@/components/NavBar'
import type { Actor } from '@/lib/domain/types'
import { isChef } from '@/lib/domain/types'

/**
 * Coquille commune à tous les espaces connectés : fond, largeur, thème sombre
 * et barre de navigation. Chaque groupe de routes la monte derrière sa propre
 * garde, pour qu'aucune page ne se retrouve sans navigation.
 */
export function AppShell({
  user,
  unread,
  children,
}: {
  user: Actor
  unread: number
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh bg-stone-50 pb-20 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <main className="mx-auto max-w-3xl p-4">{children}</main>
      <NavBar role={user.role} isChef={isChef(user)} unread={unread} />
    </div>
  )
}
