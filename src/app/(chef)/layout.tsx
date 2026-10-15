import type { ReactNode } from 'react'
import { AppShell } from '@/components/AppShell'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { countUnread } from '@/lib/services/notificationService'

export default async function ChefLayout({ children }: { children: ReactNode }) {
  const user = await requireChef()
  return (
    <AppShell user={user} unread={await countUnread(db, user.id)}>
      {children}
    </AppShell>
  )
}
