import { Picto } from '@/components/sgdf/Picto'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { getLeaderboard } from '@/lib/services/pointsService'
import { getVisibleProject } from '@/lib/services/projectService'

const MEDAILLES = ['🥇', '🥈', '🥉']

export default async function ClassementPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireUser()
  const { projectId } = await params
  const project = await getVisibleProject(db, user, projectId)
  const classement = await getLeaderboard(db, project.id)

  return (
    <div className="flex flex-col gap-4">

      {classement.length === 0 ? (
        <p className="text-sm text-encre-douce">Aucun jeune inscrit pour l&apos;instant.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {classement.map((ligne, index) => (
            <li
              key={ligne.userId}
              className={`flex items-center gap-3 rounded-xl border border-trait bg-carte p-3 ${
                ligne.userId === user.id ? 'border-accent' : ''
              }`}
            >
              <span className="w-8 text-center text-xl" aria-hidden>
                {MEDAILLES[index] ?? index + 1}
              </span>
              <span className="flex-1 font-semibold">{ligne.displayName}</span>
              <span className="flex items-center gap-1 text-sm text-encre-douce">
                {ligne.badgeCount}
                <Picto nom="promesse" taille={14} titre="écussons" />
              </span>
              <span className="font-black text-ok">{ligne.points} pts</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
