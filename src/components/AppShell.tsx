import type { ReactNode } from 'react'
import { NavBar } from '@/components/NavBar'
import type { Actor } from '@/lib/domain/types'
import { isChef } from '@/lib/domain/types'

/**
 * Coquille commune à tous les espaces connectés. Chaque groupe de routes
 * la monte derrière sa propre garde, pour qu'aucune page ne se retrouve
 * sans navigation.
 */
export function AppShell({ user, unread, children }: { user: Actor; unread: number; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface pb-24 text-encre">
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
      <NavBar role={user.role} isChef={isChef(user)} unread={unread} />
    </div>
  )
}
