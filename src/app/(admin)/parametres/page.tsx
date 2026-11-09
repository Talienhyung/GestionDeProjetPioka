import { PageHeader } from '@/components/PageHeader'
import { ScaleForm } from '@/components/ScaleForm'
import { StretchGoalsForm } from '@/components/StretchGoalsForm'
import { BadgePicto, teinteBadge } from '@/components/sgdf/BadgePicto'
import { requireSuperAdmin } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { getScale, getStretchGoals } from '@/lib/services/settingsService'

export default async function ParametresPage() {
  await requireSuperAdmin()
  const [scale, goals, badges] = await Promise.all([
    getScale(db),
    getStretchGoals(db),
    db.badge.findMany({ orderBy: { sortOrder: 'asc' } }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader picto="engrenage" surtitre="Administration" titre="Paramètres" retour={{ href: '/profil', label: 'Profil' }} description="Paliers des récoltes, barème des points et badges." />

      <section>
        <h2 className="panneau-titre mb-2 text-lg">Paliers des récoltes</h2>
        <p className="mb-2 text-sm text-encre-douce">
          Chaque palier pose un fanion sur la barre des récoltes de l&apos;accueil. Le dernier palier marque
          le bout de la barre.
        </p>
        <StretchGoalsForm goals={goals} />
      </section>

      <section>
        <h2 className="panneau-titre mb-2 text-lg">Barème des points</h2>
        <p className="panneau mb-2 text-sm text-encre-douce">
          Les tâches déjà validées gardent les points qu&apos;elles ont rapportés.
        </p>
        <ScaleForm scale={scale} />
      </section>

      <section>
        <h2 className="panneau-titre mb-2 text-lg">Badges</h2>
        <ul className="flex flex-col gap-2">
          {badges.map((badge) => (
            <li key={badge.id} className="flex items-center gap-3 rounded-xl border border-trait bg-carte p-3 text-sm">
              <span className={`grid size-10 shrink-0 place-items-center rounded-full ${teinteBadge(badge.sortOrder)}`}>
                <BadgePicto code={badge.code} icon={badge.icon} taille={22} />
              </span>
              <span className="flex-1">
                <strong>{badge.name}</strong>
                <span className="block text-encre-douce">{badge.description}</span>
              </span>
              <span className="shrink-0 text-right text-encre-douce">
                seuil {badge.threshold}
                <span className="block">{badge.points} pts</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
