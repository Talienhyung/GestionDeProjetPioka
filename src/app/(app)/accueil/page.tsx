import Link from 'next/link'
import { Icone } from '@/components/Icone'
import { Celebration } from '@/components/Celebration'
import { Itineraire } from '@/components/Itineraire'
import { TaskCard } from '@/components/TaskCard'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { PHASES, isChef, type Phase } from '@/lib/domain/types'
import { listNotifications } from '@/lib/services/notificationService'
import { getLeaderboard, getScore } from '@/lib/services/pointsService'
import { getActiveProject } from '@/lib/services/projectService'
import { getScale } from '@/lib/services/settingsService'
import { listBoard } from '@/lib/services/taskService'

export default async function AccueilPage() {
  const user = await requireUser()
  const project = await getActiveProject(db)

  const [score, notifications, badges, scale] = await Promise.all([
    getScore(db, user.id),
    listNotifications(db, user.id, 4),
    db.userBadge.findMany({
      where: { userId: user.id },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' },
      take: 6,
    }),
    getScale(db),
  ])

  const board = project ? await listBoard(db, project.id) : null
  const classement = project ? await getLeaderboard(db, project.id) : []
  const rang = classement.findIndex((ligne) => ligne.userId === user.id) + 1

  const mesTaches = board
    ? PHASES.flatMap((phase) => board[phase]).filter(
        (task) => task.assignments.some((a) => a.user.id === user.id) && task.status !== 'TERMINEE',
      )
    : []

  const fete = notifications.find((n) => !n.readAt && ['TACHE_VALIDEE', 'BADGE'].includes(n.type))

  return (
    <div className="flex flex-col gap-6">
      <Celebration trigger={fete?.id ?? null} />

      <header className="courbes overflow-hidden rounded-xl bg-bandeau px-4 py-4 text-sur-bandeau">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="panneau text-xs opacity-90">Salut {user.displayName}</p>
            {/* Un seul élément : un lecteur d'écran annonce « 75 points ». */}
            <p className="panneau text-5xl leading-none tabular-nums">
              {score}{' '}
              <span className="block text-xs opacity-90">points</span>
            </p>
          </div>

          {rang > 0 && !isChef(user) ? (
            <p className="panneau text-right text-sm leading-tight opacity-90">
              {rang}
              <sup>{rang === 1 ? 'er' : 'e'}</sup>
              <span className="block text-xs">de la caravane</span>
            </p>
          ) : null}
        </div>

        {project ? <p className="mt-3 text-sm opacity-90">{project.title}</p> : null}
      </header>

      {board && project ? <Itineraire board={board} phaseCourante={project.currentPhase as Phase} /> : null}

      <section className="flex flex-col gap-2">
        <h2 className="panneau text-sm text-encre-douce">Mes tâches en cours</h2>
        {mesTaches.length === 0 ? (
          <p className="text-sm text-encre-douce">
            Rien en cours.{' '}
            <Link href="/cap" className="font-bold text-accent-encre underline">
              Va prendre une tâche
            </Link>
          </p>
        ) : (
          mesTaches.map((task) => (
            <TaskCard key={task.id} task={task} currentUserId={user.id} points={scale[task.difficulty as keyof typeof scale]} />
          ))
        )}
      </section>

      <section>
        <h2 className="panneau mb-2 text-sm text-encre-douce">Mes écussons</h2>
        {badges.length === 0 ? (
          <p className="text-sm text-encre-douce">
            Aucun écusson pour l’instant. Le premier arrive dès ta première tâche validée.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <li
                key={b.id}
                title={b.badge.description}
                className="w-20 rounded-lg border border-trait bg-carte px-1 py-2 text-center"
              >
                <span className="text-2xl" aria-hidden>
                  {b.badge.icon}
                </span>
                <p className="panneau mt-0.5 text-[10px] leading-tight">{b.badge.name}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="panneau text-sm text-encre-douce">Dernières nouvelles</h2>
          <Link href="/notifications" className="text-xs text-accent-encre underline">
            tout voir
          </Link>
        </div>

        <ul className="flex flex-col gap-1.5">
          {notifications.length === 0 ? (
            <li className="text-sm text-encre-douce">Rien de neuf.</li>
          ) : null}
          {notifications.map((n) => (
            <li key={n.id}>
              <Link
                href={n.link}
                className={`flex items-start gap-2 rounded-lg border border-trait bg-carte p-2.5 text-sm ${
                  n.readAt ? 'text-encre-douce' : ''
                }`}
              >
                <Icone nom="cloche" taille={16} className={n.readAt ? '' : 'text-accent'} />
                <span className="min-w-0 flex-1">{n.message}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
