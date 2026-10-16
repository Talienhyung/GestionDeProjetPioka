// src/app/(app)/cap/[taskId]/page.tsx
import { ActionButton } from '@/components/ActionButton'
import { SubmissionThread } from '@/components/SubmissionThread'
import { SubmitWorkForm } from '@/components/SubmitWorkForm'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { canPerform } from '@/lib/domain/tasks'
import { DIFFICULTY_LABELS, isChef, type Difficulty, type Phase, type TaskStatus } from '@/lib/domain/types'
import { notFound } from 'next/navigation'
import { getVisibleProject } from '@/lib/services/projectService'
import { getTaskDetail } from '@/lib/services/taskService'
import { PHASE_STYLES, STATUS_LABELS, difficultyMarks } from '@/lib/ui/phases'
import { cancelValidationAction, joinAction, leaveAction, removeParticipantAction } from './actions'

export default async function TaskPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>
}) {
  const user = await requireUser()
  const { projectId, taskId } = await params

  // Le projet de l'adresse doit être visible de cet acteur, et la tâche lui
  // appartenir : sinon un brouillon fuirait par le lien d'une de ses tâches.
  await getVisibleProject(db, user, projectId)
  const task = await getTaskDetail(db, taskId)
  if (task.projectId !== projectId) notFound()

  const ctx = {
    status: task.status as TaskStatus,
    participantCount: task.assignments.length,
    hasSubmission: task.submissions.length > 0,
    projectArchived: task.project.status === 'ARCHIVE',
    isParticipant: task.assignments.some((a) => a.user.id === user.id),
    actorRole: user.role,
  }
  const style = PHASE_STYLES[task.phase as Phase]

  return (
    <div className="flex flex-col gap-5">
      <header className={`flex overflow-hidden rounded-xl border border-trait ${style.border} ${style.soft}`}>
        <span aria-hidden className={`w-2 shrink-0 ${style.rail}`} />
        <div className="flex-1 p-4">
          <p className={`panneau text-xs ${style.ink}`}>
            {style.label} · {difficultyMarks(task.difficulty as Difficulty)}{' '}
            {DIFFICULTY_LABELS[task.difficulty as Difficulty]}
          </p>
          <h1 className="panneau mt-1 text-2xl leading-tight">{task.title}</h1>
          <p className="mt-1 text-sm text-encre-douce">{STATUS_LABELS[task.status as TaskStatus]}</p>
        </div>
      </header>

      {task.description ? <p className="whitespace-pre-wrap">{task.description}</p> : null}

      <section>
        <h2 className="panneau text-sm text-encre-douce">Qui s’en occupe</h2>
        {task.assignments.length === 0 ? (
          <p className="text-sm text-encre-douce">Personne pour l’instant.</p>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-2">
            {task.assignments.map((a) => (
              <li
                key={a.user.id}
                className="flex items-center gap-2 rounded-full border border-trait bg-carte px-3 py-1 text-sm"
              >
                {a.user.displayName}
                {isChef(user) && task.status !== 'TERMINEE' ? (
                  <ActionButton
                    action={removeParticipantAction.bind(null, task.id, a.user.id)}
                    className="text-xs underline"
                    confirm={`Retirer ${a.user.displayName} de cette tâche ?`}
                  >
                    retirer
                  </ActionButton>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex gap-2">
        {canPerform(ctx, 'S_INSCRIRE') ? (
          <ActionButton
            action={joinAction.bind(null, task.id)}
            className="panneau rounded-lg bg-bouton px-5 py-3 text-base text-sur-bouton"
          >
            Je m&apos;inscris
          </ActionButton>
        ) : null}

        {canPerform(ctx, 'SE_DESINSCRIRE') ? (
          <ActionButton action={leaveAction.bind(null, task.id)} className="rounded-lg border border-trait px-4 py-3 text-sm">
            Me retirer
          </ActionButton>
        ) : null}
      </div>

      {canPerform(ctx, 'SOUMETTRE') ? (
        <SubmitWorkForm taskId={task.id} aCorriger={task.status === 'A_CORRIGER'} />
      ) : null}

      {isChef(user) && canPerform(ctx, 'ANNULER_VALIDATION') ? (
        <ActionButton
          action={cancelValidationAction.bind(null, task.id)}
          className="self-start rounded-lg border border-trait px-4 py-2 text-sm"
          confirm="Annuler la validation ? Les points versés seront repris et la tâche repassera à corriger."
        >
          Annuler la validation
        </ActionButton>
      ) : null}

      <SubmissionThread submissions={task.submissions} />
    </div>
  )
}
