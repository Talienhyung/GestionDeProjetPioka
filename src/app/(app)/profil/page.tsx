import Link from 'next/link'
import { EcussonBadge } from '@/components/EcussonBadge'
import { Picto } from '@/components/sgdf/Picto'
import type { NomPicto } from '@/components/sgdf/pictos'
import { logoutAction } from '@/app/(auth)/login/actions'
import { requireUser } from '@/lib/auth/guard'
import { badgeReason } from '@/lib/domain/badgeReasons'
import { isChef } from '@/lib/domain/types'
import { db } from '@/lib/db'
import { getLedger, getScore } from '@/lib/services/pointsService'
import { apparenceBadge } from '@/lib/ui/apparenceBadge'
import { salutation } from '@/lib/ui/salutation'

const MOTIFS: Record<string, string> = {
  TACHE: 'Tâche validée',
  BONUS: 'Points d’un chef',
  ROLE: 'Rôle tenu',
  BADGE: 'Badge débloqué',
  ANNULATION: 'Validation annulée',
}

/** Petite inclinaison fixe par badge : des écussons cousus à la main, pas une grille. */
const INCLINAISONS = ['-rotate-[8deg]', 'rotate-[5deg]', '-rotate-[4deg]', 'rotate-[9deg]', '-rotate-[6deg]', 'rotate-[3deg]']

export default async function ProfilPage() {
  const user = await requireUser()
  const [score, ledger, moi, earned] = await Promise.all([
    getScore(db, user.id),
    getLedger(db, user.id),
    db.user.findUnique({ where: { id: user.id }, select: { groupe: { select: { name: true } } } }),
    db.userBadge.findMany({
      where: { userId: user.id },
      include: { badge: true, project: { select: { title: true } } },
      orderBy: { earnedAt: 'asc' },
    }),
  ])

  // L'espace de gestion, rangé par thème. Chaque section n'apparaît qu'à qui y a accès.
  const sectionsGestion: { titre: string; liens: { href: string; label: string; detail: string; picto: NomPicto }[] }[] = [
    ...(isChef(user)
      ? [
          {
            titre: 'La caravane',
            liens: [
              { href: '/membres', label: 'Les jeunes', detail: 'Récompenser, mot de passe oublié', picto: 'visage' as NomPicto },
              { href: '/groupes', label: 'Les groupes', detail: 'Composer les équipes', picto: 'equipe' as NomPicto },
            ],
          },
          {
            titre: 'Les CAP',
            liens: [
              { href: '/pilotage', label: 'Pilotage des CAP', detail: 'Phases, couvertures, archives', picto: 'boussole' as NomPicto },
              { href: '/extra-jobs', label: 'Extra jobs', detail: 'Petits boulots et récoltes', picto: 'euros' as NomPicto },
            ],
          },
        ]
      : []),
    ...(user.role === 'SUPER_ADMIN'
      ? [
          {
            titre: 'Administration',
            liens: [
              { href: '/comptes', label: 'Comptes', detail: 'Créer en lot, désactiver, supprimer', picto: 'equipe' as NomPicto },
              { href: '/badges', label: 'Badges', detail: 'Écussons, pictos, niveaux', picto: 'promesse' as NomPicto },
              { href: '/parametres', label: 'Paramètres', detail: 'Paliers des récoltes, barème', picto: 'engrenage' as NomPicto },
              { href: '/sauvegarde', label: 'Sauvegarde', detail: 'Exporter les données', picto: 'coche' as NomPicto },
            ],
          },
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
          {moi?.groupe ? <p className="panneau mt-1 text-xs opacity-85">Groupe · {moi.groupe.name}</p> : null}
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
          <ul className="grid grid-cols-3 gap-x-3 gap-y-6 pt-2 sm:grid-cols-4">
            {earned.map(({ id, badge, earnedAt, project, reason }, i) => (
              <li key={id} className="flex justify-center">
                <EcussonBadge
                  apparence={apparenceBadge(badge)}
                  name={badge.name}
                  description={badge.description}
                  reason={reason ?? badgeReason(badge.ruleType, badge.threshold)}
                  earnedAt={earnedAt}
                  projectTitle={project?.title ?? null}
                  points={badge.points}
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
                  {ligne.note ? <span className="block text-xs text-encre-douce">« {ligne.note} »</span> : null}
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

      {sectionsGestion.length > 0 ? (
        <section className="flex flex-col gap-5">
          <h2 className="panneau-titre text-lg">Gestion</h2>
          {sectionsGestion.map((section) => (
            <div key={section.titre}>
              <h3 className="panneau mb-2 text-[11px] text-encre-douce">{section.titre}</h3>
              <ul className="overflow-hidden rounded-xl border border-trait bg-carte">
                {section.liens.map((lien, i) => (
                  <li key={lien.href} className={i > 0 ? 'border-t border-trait' : ''}>
                    <Link href={lien.href} className="group flex items-center gap-3 p-3 hover:bg-surface">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-haute text-accent">
                        <Picto nom={lien.picto} taille={22} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold group-hover:text-accent">{lien.label}</span>
                        <span className="block truncate text-xs text-encre-douce">{lien.detail}</span>
                      </span>
                      <span aria-hidden className="text-encre-douce">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}

      <div className="flex flex-col gap-2">
        <Link href="/profil/mot-de-passe" className="rounded-lg border border-trait bg-carte p-3 text-center font-semibold">
          Changer mon mot de passe
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full rounded-lg p-3 text-center font-semibold text-erreur hover:bg-erreur-doux"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  )
}
