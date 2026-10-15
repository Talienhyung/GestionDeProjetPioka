import { ScaleForm } from '@/components/ScaleForm'
import { requireSuperAdmin } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { getScale } from '@/lib/services/settingsService'

export default async function ParametresPage() {
  await requireSuperAdmin()
  const [scale, badges] = await Promise.all([
    getScale(db),
    db.badge.findMany({ orderBy: { sortOrder: 'asc' } }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Paramètres</h1>

      <section>
        <h2 className="mb-2 text-lg font-bold">Barème des points</h2>
        <p className="mb-2 text-sm opacity-70">
          Les tâches déjà validées gardent les points qu&apos;elles ont rapportés.
        </p>
        <ScaleForm scale={scale} />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Badges</h2>
        <ul className="flex flex-col gap-2">
          {badges.map((badge) => (
            <li key={badge.id} className="flex items-center gap-3 rounded-xl border p-3 text-sm">
              <span className="text-2xl" aria-hidden>{badge.icon}</span>
              <span className="flex-1">
                <strong>{badge.name}</strong>
                <span className="block opacity-70">{badge.description}</span>
              </span>
              <span className="shrink-0 text-right opacity-70">
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
