import { PageHeader } from '@/components/PageHeader'
import { ScaleForm } from '@/components/ScaleForm'
import { StretchGoalsForm } from '@/components/StretchGoalsForm'
import Link from 'next/link'
import { Ecusson } from '@/components/Ecusson'
import { requireSuperAdmin } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { getScale, getStretchGoals } from '@/lib/services/settingsService'
import { apparenceBadge } from '@/lib/ui/apparenceBadge'

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
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="panneau-titre text-lg">Badges</h2>
          <Link href="/badges" className="panneau text-xs text-accent underline">
            Gérer les badges
          </Link>
        </div>
        <Link
          href="/badges"
          className="flex flex-wrap gap-3 rounded-xl border border-trait bg-carte p-4 hover:border-encre-douce"
        >
          {badges.map((badge) => (
            <Ecusson key={badge.id} {...apparenceBadge(badge)} taille={44} ruban={false} />
          ))}
        </Link>
      </section>
    </div>
  )
}
