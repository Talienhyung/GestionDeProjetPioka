import Link from 'next/link'
import { Ecusson } from '@/components/Ecusson'
import { PageHeader } from '@/components/PageHeader'
import { requireSuperAdmin } from '@/lib/auth/guard'
import { NOMS_NIVEAUX, niveauRomain } from '@/lib/domain/badgeLook'
import { db } from '@/lib/db'
import { listBadgesAdmin } from '@/lib/services/badgeAdminService'
import { apparenceBadge } from '@/lib/ui/apparenceBadge'
import { resumeRegle } from '@/lib/ui/reglesBadges'

export default async function BadgesPage() {
  await requireSuperAdmin()
  const badges = await listBadgesAdmin(db)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        picto="coupe"
        surtitre="Administration"
        titre="Badges"
        retour={{ href: '/profil', label: 'Profil' }}
        description="Les écussons que les jeunes gagnent. Touche un badge pour le modifier."
        action={
          <Link href="/badges/nouveau" className="panneau rounded-lg bg-bouton px-3 py-2 text-xs text-sur-bouton">
            + Nouveau
          </Link>
        }
      />

      {badges.length === 0 ? (
        <p className="rounded-xl border border-dashed border-trait p-4 text-sm text-encre-douce">
          Aucun badge pour l’instant. Crée le premier !
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {badges.map((badge) => (
            <li key={badge.id}>
              <Link
                href={`/badges/${badge.id}`}
                className="flex items-center gap-4 rounded-xl border border-trait bg-carte p-3 pb-4 hover:border-encre-douce"
              >
                <Ecusson {...apparenceBadge(badge)} taille={56} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <strong className="truncate">{badge.name}</strong>
                    <span className="panneau shrink-0 text-[10px] text-encre-douce">
                      {niveauRomain(badge.level)} · {NOMS_NIVEAUX[badge.level]}
                    </span>
                  </span>
                  <span className="block truncate text-sm text-encre-douce">{resumeRegle(badge.ruleType, badge.threshold)}</span>
                  <span className="block text-xs text-encre-douce tabular-nums">
                    {badge.points > 0 ? `+${badge.points} pts · ` : ''}
                    {badge._count.userBadges === 0
                      ? 'pas encore gagné'
                      : `gagné ${badge._count.userBadges} fois`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
