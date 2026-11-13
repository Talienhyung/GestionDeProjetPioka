import { notFound } from 'next/navigation'
import { ActionButton } from '@/components/ActionButton'
import { Ecusson } from '@/components/Ecusson'
import { PageHeader } from '@/components/PageHeader'
import { DonnerPoints, RemettreBadge } from '@/components/RecompenseForms'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { NotFoundError } from '@/lib/services/errors'
import { fichePourRecompenser } from '@/lib/services/recompenseService'
import { apparenceBadge } from '@/lib/ui/apparenceBadge'
import { awardBadgeAction, awardPointsAction, revokeBadgeAction } from '../actions'

const MOTIFS: Record<string, string> = {
  TACHE: 'Tâche validée',
  BONUS: 'Donnés par un chef',
  ROLE: 'Rôle tenu',
  BADGE: 'Écusson',
  ANNULATION: 'Validation annulée',
}

const jour = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })

export default async function RecompenserPage({ params }: { params: Promise<{ userId: string }> }) {
  const chef = await requireChef()
  const { userId } = await params
  let fiche
  try {
    fiche = await fichePourRecompenser(db, chef, userId)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }
  const { user, badges, gagnes, points, projets } = fiche
  const score = points.reduce((t, p) => t + p.amount, 0)
  const badgeParId = new Map(badges.map((b) => [b.id, b]))
  const projetsVivants = projets.filter((p) => p.status === 'EN_COURS')

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        picto="promesse"
        surtitre="Récompenser"
        titre={user.displayName}
        retour={{ href: '/membres', label: 'Les jeunes' }}
      >
        <p className="flex gap-4 text-sm text-encre-douce">
          <span>
            <strong className="brush text-2xl text-encre tabular-nums">{score}</strong> points
          </span>
          <span>
            <strong className="brush text-2xl text-encre tabular-nums">{gagnes.length}</strong> écusson
            {gagnes.length > 1 ? 's' : ''}
          </span>
        </p>
      </PageHeader>

      <section className="rounded-2xl border border-trait bg-carte p-4">
        <h2 className="panneau-titre mb-3 text-lg">Remettre un écusson</h2>
        <RemettreBadge
          action={awardBadgeAction.bind(null, user.id)}
          projets={projetsVivants}
          badges={badges.map((b) => ({
            id: b.id,
            name: b.name,
            points: b.points,
            apparence: apparenceBadge(b),
            dejaGagne: gagnes.some((g) => g.badgeId === b.id),
          }))}
        />
      </section>

      <section className="rounded-2xl border border-trait bg-carte p-4">
        <h2 className="panneau-titre mb-3 text-lg">Donner des points</h2>
        <DonnerPoints action={awardPointsAction.bind(null, user.id)} projets={projetsVivants} />
      </section>

      {gagnes.length > 0 ? (
        <section>
          <h2 className="panneau-titre mb-2 text-lg">Ses écussons</h2>
          <ul className="flex flex-col gap-2">
            {gagnes.map((g) => {
              const b = badgeParId.get(g.badgeId)
              if (!b) return null
              return (
                <li key={g.id} className="flex items-center gap-3 rounded-xl border border-trait bg-carte p-2">
                  <Ecusson {...apparenceBadge(b)} taille={40} ruban={false} />
                  <span className="min-w-0 flex-1 text-sm">
                    <strong>{b.name}</strong>
                    <span className="block text-xs text-encre-douce">
                      {jour(g.earnedAt)} · {g.reason ? `« ${g.reason} »` : 'gagné par sa règle'}
                    </span>
                  </span>
                  <ActionButton
                    action={revokeBadgeAction.bind(null, user.id, b.id)}
                    confirm={`Retirer l'écusson « ${b.name} » à ${user.displayName} ? Ses points partent avec.`}
                    className="rounded-lg px-2 py-1 text-xs text-erreur hover:bg-erreur-doux"
                  >
                    Retirer
                  </ActionButton>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {points.length > 0 ? (
        <section>
          <h2 className="panneau-titre mb-2 text-lg">Ses points</h2>
          <ul className="flex flex-col gap-1">
            {points.slice(0, 30).map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-3 rounded-lg border border-trait bg-carte p-2 text-sm">
                <span className="min-w-0">
                  {MOTIFS[p.reason] ?? p.reason}
                  {p.task ? <span className="text-encre-douce"> · {p.task.title}</span> : null}
                  {p.note ? <span className="block text-xs text-encre-douce">« {p.note} »</span> : null}
                </span>
                <span className="shrink-0 text-right">
                  <span className={`font-semibold tabular-nums ${p.amount < 0 ? 'text-erreur' : 'text-ok'}`}>
                    {p.amount > 0 ? '+' : ''}
                    {p.amount}
                  </span>
                  <span className="block text-[11px] text-encre-douce">{jour(p.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
