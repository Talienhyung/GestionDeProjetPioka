import { PageHeader } from '@/components/PageHeader'
import { ActionButton } from '@/components/ActionButton'
import { Calendrier, EvenementLigne } from '@/components/Calendrier'
import { EvenementForm } from '@/components/EvenementForm'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { dayKey, parisDateTime, parseMonth, shiftMonth } from '@/lib/domain/agenda'
import { isChef } from '@/lib/domain/types'
import { listAssignableRoles, listEvents, listUpcomingEvents } from '@/lib/services/eventService'
import { deleteEventAction } from './actions'

type Search = Promise<{ mois?: string; jour?: string }>

/** L'agenda de la caravane ; les chefs y ajoutent et retirent des événements. */
export default async function AgendaPage({ searchParams }: { searchParams: Search }) {
  const user = await requireUser()
  const chef = isChef(user)
  const { mois, jour } = await searchParams
  const { year, month } = parseMonth(mois, new Date())
  const debut = parisDateTime(`${year}-${String(month).padStart(2, '0')}-01`)!
  const fin = parisDateTime(`${shiftMonth(year, month, 1)}-01`)!

  const [events, prochains, roles] = await Promise.all([
    listEvents(db, user, new Date(debut.getTime() - 7 * 864e5), new Date(fin.getTime() + 7 * 864e5)),
    listUpcomingEvents(db, user, 20),
    chef ? listAssignableRoles(db) : Promise.resolve([]),
  ])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader picto="calendrier" surtitre="La caravane" titre="Agenda" description={chef ? 'Ajoute les réunions, week-ends et camps, pour tous ou pour certains rôles.' : 'Les réunions, week-ends et camps qui te concernent.'} />

      <Calendrier
        year={year}
        month={month}
        events={events}
        selected={jour}
        basePath="/agenda"
        upcoming={prochains.slice(0, 3)}
      />

      {chef ? (
        <details className="rounded-xl border border-trait bg-carte p-4" open={prochains.length === 0}>
          <summary className="panneau cursor-pointer text-sm">+ Nouvel événement</summary>
          <div className="mt-3">
            <EvenementForm roles={roles} defaultDate={jour ?? dayKey(new Date())} />
          </div>
        </details>
      ) : null}

      {chef && prochains.length > 0 ? (
        <section>
          <h2 className="panneau-titre mb-2 text-lg">Tous les événements à venir</h2>
          <ul className="flex flex-col gap-2">
            {prochains.map((e) => (
              <EvenementLigne key={e.id} event={e}>
                <ActionButton
                  action={deleteEventAction.bind(null, e.id)}
                  confirm={`Retirer « ${e.title} » de l’agenda ?`}
                  className="mt-2 text-xs text-erreur underline"
                >
                  retirer
                </ActionButton>
              </EvenementLigne>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
