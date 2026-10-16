'use client'

import Image from 'next/image'
import { useActionState } from 'react'
import { reviewAction } from '@/app/(chef)/validation/actions'
import { EMPTY_FORM_STATE } from '@/lib/formState'

interface Props {
  submission: {
    id: string
    message: string
    submittedBy: { displayName: string }
    attachments: { id: string; originalName: string; width: number; height: number }[]
    task: {
      title: string
      difficulty: string
      project: { id: string; title: string }
      assignments: { user: { displayName: string } }[]
    }
  }
  maxBonus: number
  pointsParJeune: number
}

export function ReviewCard({ submission, maxBonus, pointsParJeune }: Props) {
  const [state, action, pending] = useActionState(reviewAction, EMPTY_FORM_STATE)

  return (
    <article className="rounded-xl border border-trait bg-carte p-4 shadow-sm">
      <p className="panneau text-[11px] text-encre-douce">{submission.task.project.title}</p>
      <h3 className="panneau-titre text-lg">{submission.task.title}</h3>
      <p className="text-sm text-encre-douce">
        Rendu par {submission.submittedBy.displayName} ·{' '}
        {submission.task.assignments.map((a) => a.user.displayName).join(', ')} ·{' '}
        {pointsParJeune} pts par jeune
      </p>

      {submission.message ? <p className="mt-2 whitespace-pre-wrap text-sm">{submission.message}</p> : null}

      {submission.attachments.length > 0 ? (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {submission.attachments.map((photo) => (
            <li key={photo.id}>
              {/* unoptimized : voir SubmissionThread, l'optimiseur perd le cookie. */}
              <Image src={`/api/fichiers/${photo.id}`} alt={photo.originalName} unoptimized
                width={photo.width} height={photo.height} className="h-24 w-full rounded-lg object-cover" />
            </li>
          ))}
        </ul>
      ) : null}

      <form action={action} className="mt-4 flex flex-col gap-3">
        <input type="hidden" name="submissionId" value={submission.id} />

        <label className="text-sm">
          Bonus (0 à {maxBonus} points)
          <input name="bonus" type="number" min={0} max={maxBonus} defaultValue={0}
            className="mt-1 w-24 rounded-lg border border-trait p-2" />
        </label>

        <textarea name="comment" rows={2} className="rounded-lg border border-trait p-2"
          placeholder="Commentaire (obligatoire en cas de refus)" />

        {state.error ? <p role="alert" className="rounded-lg bg-erreur-doux p-2 text-sm text-erreur">{state.error}</p> : null}
        {state.success ? <p className="rounded-lg bg-ok-doux p-2 text-sm text-ok">{state.success}</p> : null}

        <div className="flex gap-2">
          <button name="decision" value="ACCEPTEE" disabled={pending}
            className="flex-1 panneau rounded-lg bg-bouton p-3 text-base text-sur-bouton disabled:opacity-60">
            ✅ Valider
          </button>
          <button name="decision" value="REFUSEE" disabled={pending}
            className="flex-1 rounded-lg bg-alerte p-3 text-base text-surface disabled:opacity-60">
            ✏️ À corriger
          </button>
        </div>
      </form>
    </article>
  )
}
