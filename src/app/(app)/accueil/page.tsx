import Link from 'next/link'
import { Celebration } from '@/components/Celebration'
import { Icone } from '@/components/Icone'
import { ProgressBar } from '@/components/ProgressBar'
import { TaskCard } from '@/components/TaskCard'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { PHASES, isChef, type Phase } from '@/lib/domain/types'
import { listRecentNotes } from '@/lib/services/noteService'
import { listNotifications } from '@/lib/services/notificationService'
import { getScore } from '@/lib/services/pointsService'
import { listLiveProjects } from '@/lib/services/projectService'
import { getScale } from '@/lib/services/settingsService'
import { listBoard } from '@/lib/services/taskService'
import { PHASE_STYLES, phaseProgress } from '@/lib/ui/phases'

export default async function AccueilPage() {
  const user = await requireUser()

  const [score, notifications, badges, scale, projets, billets] = await Promise.all([
    getScore(db, user.id),
    listNotifications(db, user.id, 4),
    db.userBadge.findMany({
      where: { userId: user.id },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' },
      take: 6,
    }),
    getScale(db),
    listLiveProjects(db),
    listRecentNotes(db, user, 2),
  ])

  // Un CAP par ligne, avec ce qu'il me reste dessus.
  const caps = await Promise.all(
    projets.map(async (projet) => {
      const board = await listBoard(db, projet.id)
      const taches = PHASES.flatMap((phase) => board[phase])
      return {
        projet,
        avancement: phaseProgress(taches),
        miennes: taches.filter(
          (task) => task.assignments.some((a) => a.user.id === user.id) && task.status !== 'TERMINEE',
        ),
      }
    }),
  )

  const mesTaches = caps.flatMap((cap) => cap.miennes.map((task) => ({ task, projectId: cap.projet.id })))
  const fete = notifications.find((n) => !n.readAt && ['TACHE_VALIDEE', 'BADGE'].includes(n.type))

  return (
    <div className="flex flex-col gap-6">
      <Celebration trigger={fete?.id ?? null} />

      <header className="courbes overflow-hidden rounded-xl bg-bandeau px-4 py-4 text-sur-bandeau">
        <p className="panneau text-xs opacity-90">Salut {user.displayName}</p>
        <p className="panneau text-5xl leading-none tabular-nums">
          {score}{' '}
          <span className="block text-xs opacity-90">points en tout</span>
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="panneau text-sm text-encre-douce">
            {caps.length > 1 ? 'Nos CAP en cours' : 'Notre CAP'}
          </h2>
          <Link href="/cap" className="text-xs text-accent-encre underline">
            tout voir
          </Link>
        </div>

        {caps.length === 0 ? (
          <p className="text-sm text-encre-douce">
            Aucun CAP lancé pour l’instant{isChef(user) ? ' : prépare-en un depuis le pilotage.' : '.'}
          </p>
        ) : (
          caps.map(({ projet, avancement, miennes }) => {
            const style = PHASE_STYLES[projet.currentPhase as Phase]
            return (
              <Link
                key={projet.id}
                href={`/cap/${projet.id}`}
                className="flex overflow-hidden rounded-lg border border-trait bg-carte hover:border-encre-douce"
              >
                <span aria-hidden className={`w-1.5 shrink-0 ${style.rail}`} />
                <span className="flex-1 p-3">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="panneau-titre text-lg">{projet.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-encre-douce">
                      {avancement.done}/{avancement.total}
                    </span>
                  </span>
                  <span className={`panneau mt-0.5 block text-[11px] ${style.ink}`}>
                    étape : {style.label}
                    {miennes.length > 0 ? ` · ${miennes.length} tâche(s) à toi` : ''}
                  </span>
                  <ProgressBar percent={avancement.percent} className="mt-2" />
                </span>
              </Link>
            )
          })
        )}
      </section>

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
          mesTaches.map(({ task, projectId }) => (
            <TaskCard
              key={task.id}
              projectId={projectId}
              task={task}
              currentUserId={user.id}
              points={scale[task.difficulty as keyof typeof scale]}
            />
          ))
        )}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="panneau text-sm text-encre-douce">Au tableau</h2>
          <Link href="/tableau" className="text-xs text-accent-encre underline">
            tout voir
          </Link>
        </div>

        {billets.length === 0 ? (
          <p className="text-sm text-encre-douce">
            Rien au tableau.{' '}
            <Link href="/tableau" className="font-bold text-accent-encre underline">
              Écris le premier billet
            </Link>
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {billets.map((billet) => (
              <li key={billet.id}>
                <Link
                  href={billet.project ? `/cap/${billet.project.id}/billets` : '/tableau'}
                  className="block rounded-lg border border-trait bg-carte p-2.5"
                >
                  {billet.title ? <span className="panneau-titre text-base">{billet.title}</span> : null}
                  <span className="line-clamp-2 block text-sm">{billet.body}</span>
                  <span className="mt-1 block text-xs text-encre-douce">
                    {billet.author.displayName}
                    {billet.project ? ` · ${billet.project.title}` : ' · la caravane'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
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
          {notifications.length === 0 ? <li className="text-sm text-encre-douce">Rien de neuf.</li> : null}
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
