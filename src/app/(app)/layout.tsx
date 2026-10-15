import type { ReactNode } from 'react'
import { AppShell } from '@/components/AppShell'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { countUnread } from '@/lib/services/notificationService'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser()
  return (
    <AppShell user={user} unread={await countUnread(db, user.id)}>
      {children}
    </AppShell>
  )
}
