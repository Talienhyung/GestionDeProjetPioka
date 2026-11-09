import { PageHeader } from '@/components/PageHeader'
import { ActionButton } from '@/components/ActionButton'
import { ReviewCard } from '@/components/ReviewCard'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { computeTaskAward, maxBonus } from '@/lib/domain/points'
import type { Difficulty } from '@/lib/domain/types'
import { getScale } from '@/lib/services/settingsService'
import { listPendingSubmissions } from '@/lib/services/submissionService'
import { proposalAction } from './actions'

export default async function ValidationPage() {
  await requireChef()
  const [submissions, propositions, scale] = await Promise.all([
    listPendingSubmissions(db),
    db.task.findMany({
      where: { status: 'PROPOSEE' },
      include: {
        createdBy: { select: { displayName: true } },
        project: { select: { id: true, title: true } },
      },
    }),
    getScale(db),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader picto="coche" surtitre="Chefs" titre="À valider" description="Les travaux rendus et les tâches proposées par les jeunes." />

      <section className="flex flex-col gap-3">
        <h2 className="font-bold">Travaux rendus ({submissions.length})</h2>
        {submissions.length === 0 ? <p className="text-sm text-encre-douce">Rien en attente.</p> : null}
        {submissions.map((submission) => {
          const difficulty = submission.task.difficulty as Difficulty
          const n = Math.max(1, submission.task.assignments.length)
          return (
            <ReviewCard
              key={submission.id}
              submission={submission}
              maxBonus={maxBonus(difficulty, scale)}
              pointsParJeune={computeTaskAward(difficulty, n, 0, scale)}
            />
          )
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-bold">Tâches proposées ({propositions.length})</h2>
        {propositions.length === 0 ? <p className="text-sm text-encre-douce">Aucune proposition en attente.</p> : null}
        {propositions.map((task) => (
          <article key={task.id} className="rounded-xl border border-trait p-4">
            <p className="panneau text-[11px] text-encre-douce">{task.project.title}</p>
            <p className="panneau-titre text-lg">{task.title}</p>
            <p className="text-sm text-encre-douce">Proposée par {task.createdBy.displayName}</p>
            {task.description ? <p className="mt-2 text-sm">{task.description}</p> : null}
            <div className="mt-3 flex gap-2">
              <ActionButton
                action={proposalAction.bind(null, task.id, true)}
                className="panneau rounded-lg bg-bouton px-4 py-2 text-sur-bouton"
              >
                Accepter
              </ActionButton>
              <ActionButton
                action={proposalAction.bind(null, task.id, false)}
                className="rounded-lg border border-trait px-4 py-2"
              >
                Écarter
              </ActionButton>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
