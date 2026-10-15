import Link from 'next/link'
import { Celebration } from '@/components/Celebration'
import { ProgressBar } from '@/components/ProgressBar'
import { TaskCard } from '@/components/TaskCard'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { getScore } from '@/lib/services/pointsService'
import { getActiveProject } from '@/lib/services/projectService'
import { listNotifications } from '@/lib/services/notificationService'
import { listBoard } from '@/lib/services/taskService'
import { PHASES } from '@/lib/domain/types'
import { phaseProgress } from '@/lib/ui/phases'

export default async function AccueilPage() {
  const user = await requireUser()
  const project = await getActiveProject(db)

  const [score, notifications, badges] = await Promise.all([
    getScore(db, user.id),
    listNotifications(db, user.id, 5),
    db.userBadge.findMany({ where: { userId: user.id }, include: { badge: true }, orderBy: { earnedAt: 'desc' }, take: 6 }),
  ])

  const board = project ? await listBoard(db, project.id) : null
  const mesTaches = board
    ? PHASES.flatMap((phase) => board[phase]).filter(
        (task) => task.assignments.some((a) => a.user.id === user.id) && task.status !== 'TERMINEE',
      )
    : []
  const progress = board ? phaseProgress(PHASES.flatMap((phase) => board[phase])) : { percent: 0, done: 0, total: 0 }

  const fete = notifications.find((n) => !n.readAt && ['TACHE_VALIDEE', 'BADGE'].includes(n.type))

  return (
    <div className="flex flex-col gap-6">
      <Celebration trigger={fete?.id ?? null} />
      <header className="rounded-2xl bg-emerald-600 p-5 text-white">
        <p className="text-sm opacity-90">Salut {user.displayName} !</p>
        <p className="text-4xl font-black">{score} pts</p>
        {project ? (
          <>
            <p className="mt-3 text-sm">{project.title} · {progress.done}/{progress.total} tâches</p>
            <ProgressBar percent={progress.percent} className="mt-1" />
          </>
        ) : null}
      </header>

      <section>
        <h2 className="mb-2 text-lg font-bold">Mes tâches en cours</h2>
        {mesTaches.length === 0 ? (
          <p className="text-sm opacity-70">
            Tu n’as rien en cours. <Link href="/cap" className="underline">Va prendre une tâche !</Link>
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {mesTaches.map((task) => <TaskCard key={task.id} task={task} currentUserId={user.id} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Mes badges</h2>
        {badges.length === 0 ? (
          <p className="text-sm opacity-70">Aucun badge pour l’instant. Le premier arrive dès ta première tâche validée.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <li key={b.id} title={b.badge.description} className="rounded-xl bg-white p-2 text-center shadow-sm dark:bg-stone-900">
                <span className="text-2xl" aria-hidden>{b.badge.icon}</span>
                <p className="text-[11px]">{b.badge.name}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Dernières nouvelles</h2>
        <ul className="flex flex-col gap-2">
          {notifications.length === 0 ? <li className="text-sm opacity-70">Rien de neuf.</li> : null}
          {notifications.map((n) => (
            <li key={n.id} className={`rounded-xl border p-3 text-sm ${n.readAt ? 'opacity-60' : 'font-medium'}`}>
              <Link href={n.link}>{n.message}</Link>
            </li>
          ))}
        </ul>
        <Link href="/notifications" className="mt-2 inline-block text-sm underline">Tout voir</Link>
      </section>
    </div>
  )
}
