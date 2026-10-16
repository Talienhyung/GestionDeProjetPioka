import Link from 'next/link'
import { ActionButton } from '@/components/ActionButton'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { listNotifications } from '@/lib/services/notificationService'
import { markAllReadAction } from './actions'

export default async function NotificationsPage() {
  const user = await requireUser()
  const notifications = await listNotifications(db, user.id)
  const nonLues = notifications.filter((notification) => !notification.readAt).length

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="panneau-titre text-3xl">Notifications</h1>
        {nonLues > 0 ? (
          <ActionButton action={markAllReadAction} className="rounded-lg border border-trait px-3 py-2 text-sm">
            Tout marquer comme lu
          </ActionButton>
        ) : null}
      </header>

      {notifications.length === 0 ? (
        <p className="text-sm text-encre-douce">Rien pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={`rounded-xl border border-trait p-3 ${notification.readAt ? 'text-encre-douce' : 'bg-carte font-bold'}`}
            >
              <Link href={notification.link} className="block">
                {notification.message}
                <span className="mt-1 block text-xs text-encre-douce">
                  {notification.createdAt.toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
