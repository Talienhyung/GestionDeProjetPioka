import Link from 'next/link'
import { EcussonBadge } from '@/components/EcussonBadge'
import { teinteBadge } from '@/components/sgdf/BadgePicto'
import { Picto } from '@/components/sgdf/Picto'
import { requireUser } from '@/lib/auth/guard'
import { badgeReason } from '@/lib/domain/badgeReasons'
import { isChef } from '@/lib/domain/types'
import { db } from '@/lib/db'
import { getLedger, getScore } from '@/lib/services/pointsService'
import { salutation } from '@/lib/ui/salutation'

const MOTIFS: Record<string, string> = {
  TACHE: 'Tâche validée',
  BONUS: 'Bonus',
  ROLE: 'Rôle tenu',
  BADGE: 'Badge débloqué',
  ANNULATION: 'Validation annulée',
}

/** Petite inclinaison fixe par badge : des écussons cousus à la main, pas une grille. */
const INCLINAISONS = ['-rotate-[8deg]', 'rotate-[5deg]', '-rotate-[4deg]', 'rotate-[9deg]', '-rotate-[6deg]', 'rotate-[3deg]']

export default async function ProfilPage() {
  const user = await requireUser()
  const [score, ledger, earned] = await Promise.all([
    getScore(db, user.id),
    getLedger(db, user.id),
    db.userBadge.findMany({
      where: { userId: user.id },
      include: { badge: true, project: { select: { title: true } } },
      orderBy: { earnedAt: 'asc' },
    }),
  ])

  const liensGestion = [
    ...(isChef(user)
      ? [
          { href: '/pilotage', label: 'Pilotage des CAP' },
          { href: '/membres', label: 'Les jeunes' },
          { href: '/extra-jobs', label: 'Extra jobs' },
        ]
      : []),
    ...(user.role === 'SUPER_ADMIN'
      ? [
          { href: '/comptes', label: 'Comptes' },
          { href: '/parametres', label: 'Paramètres' },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-7">
      <header className="courbes dechire-bas -mx-4 -mt-5 flex items-center gap-4 bg-bandeau px-5 pt-7 pb-9 text-sur-bandeau">
        <div className="grid size-24 shrink-0 place-items-center rounded-full bg-sur-bandeau text-bandeau shadow-[0_0_0_4px_color-mix(in_oklab,var(--sur-bandeau)_35%,transparent)]">
          <p className="flex flex-col items-center leading-none">
            <span className="brush text-4xl tabular-nums">{score}</span>{' '}
            <span className="panneau text-[10px]">points</span>
          </p>
        </div>
        <div className="min-w-0">
          <p className="panneau text-xs opacity-85">{salutation()}</p>
          <h1 className="brush text-5xl leading-[0.95] break-words">{user.displayName}</h1>
        </div>
      </header>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="panneau-titre text-lg">Mes écussons</h2>
          {earned.length > 0 ? (
            <span className="panneau text-[11px] text-encre-douce tabular-nums">{earned.length} gagné{earned.length > 1 ? 's' : ''}</span>
          ) : null}
        </div>

        {earned.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-trait p-4 text-sm text-encre-douce">
            <Picto nom="graine" taille={36} className="text-agir" />
            <p>
              Pas encore d&apos;écusson. Le premier pousse dès ta première tâche validée :{' '}
              <Link href="/cap" className="font-bold text-accent underline">
                va en prendre une
              </Link>
              .
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4">
            {earned.map(({ id, badge, earnedAt, project }, i) => (
              <li key={id} className="flex justify-center">
                <EcussonBadge
                  code={badge.code}
                  icon={badge.icon}
                  name={badge.name}
                  description={badge.description}
                  reason={badgeReason(badge.ruleType, badge.threshold)}
                  earnedAt={earnedAt}
                  projectTitle={project?.title ?? null}
                  points={badge.points}
                  teinte={teinteBadge(badge.sortOrder)}
                  inclinaison={INCLINAISONS[i % INCLINAISONS.length]}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="panneau-titre mb-2 text-lg">D&apos;où viennent mes points</h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-encre-douce">Aucun point pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {ledger.map((ligne) => (
              <li
                key={ligne.id}
                className="flex items-baseline justify-between gap-3 rounded-lg border border-trait bg-carte p-2 text-sm"
              >
                <span>
                  {MOTIFS[ligne.reason] ?? ligne.reason}
                  {ligne.taskTitle ? <span className="text-encre-douce"> · {ligne.taskTitle}</span> : null}
                </span>
                <span className={`font-semibold ${ligne.amount < 0 ? 'text-erreur' : 'text-ok'}`}>
                  {ligne.amount > 0 ? '+' : ''}
                  {ligne.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {liensGestion.length > 0 ? (
        <section>
          <h2 className="panneau-titre mb-2 text-lg">Gestion</h2>
          <ul className="flex flex-col gap-2">
            {liensGestion.map((lien) => (
              <li key={lien.href}>
                <Link
                  href={lien.href}
                  className="block rounded-lg border border-trait bg-carte p-3 font-semibold hover:text-accent"
                >
                  {lien.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Link href="/profil/mot-de-passe" className="rounded-lg border border-trait bg-carte p-3 text-center font-semibold">
        Changer mon mot de passe
      </Link>
    </div>
  )
}
