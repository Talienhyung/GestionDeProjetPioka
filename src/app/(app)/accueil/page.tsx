import Link from 'next/link'
import { Calendrier } from '@/components/Calendrier'
import { Celebration } from '@/components/Celebration'
import { Icone } from '@/components/Icone'
import { RecoltesBar } from '@/components/RecoltesBar'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { parisDateTime, parseMonth, shiftMonth } from '@/lib/domain/agenda'
import { PHASES, isChef, type Phase } from '@/lib/domain/types'
import { listEvents, listUpcomingEvents } from '@/lib/services/eventService'
import { totalCollected } from '@/lib/services/extraJobService'
import { listNotifications } from '@/lib/services/notificationService'
import { listLiveProjects } from '@/lib/services/projectService'
import { getStretchGoals } from '@/lib/services/settingsService'
import { listBoard } from '@/lib/services/taskService'
import { PHASE_STYLES, STATUS_LABELS } from '@/lib/ui/phases'
import { salutation } from '@/lib/ui/salutation'

type Search = Promise<{ mois?: string; jour?: string }>

/** L'accueil va à l'essentiel : l'argent récolté, ce qui arrive, ce que j'ai en main. */
export default async function AccueilPage({ searchParams }: { searchParams: Search }) {
  const user = await requireUser()
  const { mois, jour } = await searchParams
  const { year, month } = parseMonth(mois, new Date())
  const debut = parisDateTime(`${year}-${String(month).padStart(2, '0')}-01`)!
  const fin = parisDateTime(`${shiftMonth(year, month, 1)}-01`)!

  const [notifications, projets, cagnotte, paliers, events, prochains] = await Promise.all([
    listNotifications(db, user.id, 10),
    listLiveProjects(db),
    totalCollected(db, user),
    getStretchGoals(db),
    listEvents(db, user, new Date(debut.getTime() - 7 * 864e5), new Date(fin.getTime() + 7 * 864e5)),
    listUpcomingEvents(db, user, 3),
  ])

  const boards = await Promise.all(projets.map(async (projet) => ({ projet, board: await listBoard(db, projet.id) })))
  const mesTaches = boards.flatMap(({ projet, board }) =>
    PHASES.flatMap((phase) => board[phase])
      .filter((task) => task.status !== 'TERMINEE' && task.assignments.some((a) => a.user.id === user.id))
      .map((task) => ({ task, projet })),
  )

  const nonLues = notifications.filter((n) => !n.readAt).length
  const fete = notifications.find((n) => !n.readAt && ['TACHE_VALIDEE', 'BADGE'].includes(n.type))

  return (
    <div className="flex flex-col gap-5">
      <Celebration trigger={fete?.id ?? null} />

      <header className="flex items-end justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="panneau text-[11px] text-encre-douce">{salutation()}</p>
          <h1 className="brush truncate text-4xl leading-none text-accent">{user.displayName}</h1>
        </div>
        <Link
          href="/notifications"
          aria-label={`Notifications${nonLues ? `, ${nonLues} non lue(s)` : ''}`}
          className="relative grid size-11 shrink-0 place-items-center rounded-full border border-trait bg-carte text-encre-douce hover:text-accent"
        >
          <Icone nom="cloche" taille={22} />
          {nonLues > 0 ? (
            <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold tabular-nums text-sur-accent">
              {nonLues}
            </span>
          ) : null}
        </Link>
      </header>

      <RecoltesBar collectedCents={cagnotte} goals={paliers} canEdit={user.role === 'SUPER_ADMIN'} />

      <Calendrier
        year={year}
        month={month}
        events={events}
        selected={jour}
        basePath="/accueil"
        upcoming={prochains}
        footer={
          <Link href="/agenda" className="panneau mt-3 inline-block text-[11px] text-accent">
            {isChef(user) ? 'Gérer l’agenda →' : 'Tout l’agenda →'}
          </Link>
        }
      />

      <section>
        <h2 className="panneau mb-2 text-[11px] text-encre-douce">Mes tâches</h2>
        {mesTaches.length === 0 ? (
          <Link
            href="/cap"
            className="block rounded-xl border border-dashed border-trait p-4 text-center text-sm text-encre-douce hover:border-accent"
          >
            Rien en cours. <span className="font-bold text-accent">Va prendre une tâche →</span>
          </Link>
        ) : (
          <ul className="flex flex-col gap-2">
            {mesTaches.map(({ task, projet }) => {
              const style = PHASE_STYLES[task.phase as Phase]
              return (
                <li key={task.id}>
                  <Link
                    href={`/cap/${projet.id}/tache/${task.id}`}
                    className="flex items-center gap-3 rounded-xl border border-trait bg-carte p-3 hover:border-encre-douce"
                  >
                    <span aria-hidden className={`h-9 w-1.5 shrink-0 rounded-full ${style.rail}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{task.title}</span>
                      <span className="block text-xs text-encre-douce">
                        {STATUS_LABELS[task.status as keyof typeof STATUS_LABELS]} · {projet.title}
                      </span>
                    </span>
                    <Icone nom="chevron" taille={18} className="text-encre-douce" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
