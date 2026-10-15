import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProgressBar } from '@/components/ProgressBar'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { DIFFICULTY_LABELS, PHASES, type Difficulty, type Phase } from '@/lib/domain/types'
import { getLeaderboard } from '@/lib/services/pointsService'
import { listBoard } from '@/lib/services/taskService'
import { PHASE_STYLES, STATUS_LABELS, phaseProgress } from '@/lib/ui/phases'
import type { TaskStatus } from '@/lib/domain/types'

/** Vue en lecture seule d'un CAP terminé : ce qui a été fait, et par qui. */
export default async function ArchivePage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireUser()
  const { projectId } = await params

  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project || project.status !== 'ARCHIVE') notFound()

  const [board, classement] = await Promise.all([listBoard(db, project.id), getLeaderboard(db, project.id)])
  const progress = phaseProgress(PHASES.flatMap((phase) => board[phase]))

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link href="/archives" className="text-sm underline">
          ← Tous les CAP précédents
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{project.title}</h1>
        <p className="text-sm opacity-70">
          Archivé le {project.archivedAt?.toLocaleDateString('fr-FR')} · {progress.done} tâches terminées
          sur {progress.total}
        </p>
        <ProgressBar percent={progress.percent} className="mt-2" />
      </header>

      {PHASES.map((phase) => {
        const style = PHASE_STYLES[phase as Phase]
        const taches = board[phase]
        if (taches.length === 0) return null

        return (
          <section key={phase} className={`rounded-2xl p-4 ${style.bg} ${style.text}`}>
            <h2 className="text-lg font-bold">
              <span aria-hidden>{style.emoji}</span> {style.label}
            </h2>
            <ul className="mt-2 flex flex-col gap-2">
              {taches.map((task) => (
                <li key={task.id} className="rounded-xl bg-white/80 p-3 text-sm dark:bg-stone-900/80">
                  <strong>{task.title}</strong>
                  <span className="block opacity-70">
                    {DIFFICULTY_LABELS[task.difficulty as Difficulty]} ·{' '}
                    {STATUS_LABELS[task.status as TaskStatus]}
                    {task.assignments.length > 0
                      ? ` · ${task.assignments.map((a) => a.user.displayName).join(', ')}`
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      <section>
        <h2 className="mb-2 text-lg font-bold">Classement final</h2>
        {classement.length === 0 ? (
          <p className="text-sm opacity-70">Aucun point sur ce CAP.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {classement.map((ligne, index) => (
              <li
                key={ligne.userId}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  ligne.userId === user.id ? 'ring-2 ring-emerald-400' : ''
                }`}
              >
                <span className="w-6 text-center">{index + 1}</span>
                <span className="flex-1">{ligne.displayName}</span>
                <span className="font-semibold">{ligne.points} pts</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
