// src/app/(app)/cap/[taskId]/page.tsx
import { ActionButton } from '@/components/ActionButton'
import { SubmissionThread } from '@/components/SubmissionThread'
import { SubmitWorkForm } from '@/components/SubmitWorkForm'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { canPerform } from '@/lib/domain/tasks'
import { DIFFICULTY_LABELS, isChef, type Difficulty, type Phase, type TaskStatus } from '@/lib/domain/types'
import { getTaskDetail } from '@/lib/services/taskService'
import { PHASE_STYLES, STATUS_LABELS } from '@/lib/ui/phases'
import { cancelValidationAction, joinAction, leaveAction, removeParticipantAction } from './actions'

export default async function TaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const user = await requireUser()
  const { taskId } = await params
  const task = await getTaskDetail(db, taskId)

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
      <header className={`rounded-2xl p-4 ${style.bg} ${style.text}`}>
        <p className="text-sm">{style.emoji} {style.label} · {DIFFICULTY_LABELS[task.difficulty as Difficulty]}</p>
        <h1 className="mt-1 text-xl font-bold">{task.title}</h1>
        <p className="mt-1 text-sm">{STATUS_LABELS[task.status as TaskStatus]}</p>
      </header>

      {task.description ? <p className="whitespace-pre-wrap">{task.description}</p> : null}

      <section>
        <h2 className="font-bold">Qui s’en occupe</h2>
        {task.assignments.length === 0 ? (
          <p className="text-sm opacity-70">Personne pour l’instant.</p>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-2">
            {task.assignments.map((a) => (
              <li
                key={a.user.id}
                className="flex items-center gap-2 rounded-full bg-stone-200 px-3 py-1 text-sm dark:bg-stone-800"
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
            className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white"
          >
            Je m&apos;inscris
          </ActionButton>
        ) : null}

        {canPerform(ctx, 'SE_DESINSCRIRE') ? (
          <ActionButton action={leaveAction.bind(null, task.id)} className="rounded-lg border px-4 py-3">
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
          className="self-start rounded-lg border px-4 py-2 text-sm"
          confirm="Annuler la validation ? Les points versés seront repris et la tâche repassera à corriger."
        >
          Annuler la validation
        </ActionButton>
      ) : null}

      <SubmissionThread submissions={task.submissions} />
    </div>
  )
}
