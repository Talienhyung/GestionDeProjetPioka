import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { getLeaderboard } from '@/lib/services/pointsService'
import { getActiveProject } from '@/lib/services/projectService'

const MEDAILLES = ['🥇', '🥈', '🥉']

export default async function ClassementPage() {
  const user = await requireUser()
  const project = await getActiveProject(db)
  if (!project) return <p>Aucun CAP en cours.</p>

  const classement = await getLeaderboard(db, project.id)

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold">Classement</h1>
        <p className="text-sm opacity-70">{project.title}</p>
      </header>

      {classement.length === 0 ? (
        <p className="text-sm opacity-70">Aucun jeune inscrit pour l&apos;instant.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {classement.map((ligne, index) => (
            <li
              key={ligne.userId}
              className={`flex items-center gap-3 rounded-xl border bg-white p-3 dark:bg-stone-900 ${
                ligne.userId === user.id ? 'ring-2 ring-emerald-400' : ''
              }`}
            >
              <span className="w-8 text-center text-xl" aria-hidden>
                {MEDAILLES[index] ?? index + 1}
              </span>
              <span className="flex-1 font-semibold">{ligne.displayName}</span>
              <span className="text-sm opacity-70">{ligne.badgeCount} 🏅</span>
              <span className="font-black text-emerald-700 dark:text-emerald-400">{ligne.points} pts</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
