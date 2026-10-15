import type { ReactNode } from 'react'
import { NavBar } from '@/components/NavBar'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { isChef } from '@/lib/domain/types'
import { countUnread } from '@/lib/services/notificationService'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser()
  const unread = await countUnread(db, user.id)

  return (
    <div className="min-h-dvh bg-stone-50 pb-20 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <main className="mx-auto max-w-3xl p-4">{children}</main>
      <NavBar role={user.role} isChef={isChef(user)} unread={unread} />
    </div>
  )
}
