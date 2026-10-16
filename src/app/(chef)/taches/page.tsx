import { ActionButton } from '@/components/ActionButton'
import { NewTaskForm } from '@/components/NewTaskForm'
import { TemplateForm } from '@/components/TemplateForm'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { DIFFICULTY_LABELS, PHASES, PHASE_LABELS, type Difficulty, type Phase } from '@/lib/domain/types'
import { PHASE_STYLES } from '@/lib/ui/phases'
import { createFromTemplateAction } from './actions'

export default async function TachesPage() {
  await requireChef()
  const templates = await db.taskTemplate.findMany({
    where: { isArchived: false },
    orderBy: [{ isBuiltin: 'desc' }, { title: 'asc' }],
  })

  return (
    <div className="flex flex-col gap-6">
      <h1 className="panneau-titre text-3xl">Créer des tâches</h1>

      <section>
        <h2 className="panneau-titre mb-2 text-lg">Nouvelle tâche</h2>
        <NewTaskForm isChef />
      </section>

      <section>
        <h2 className="panneau-titre mb-2 text-lg">Catalogue de tâches types</h2>
        <p className="mb-3 text-sm text-encre-douce">Un clic suffit pour l&apos;ajouter au CAP en cours.</p>

        {PHASES.map((phase) => {
          const style = PHASE_STYLES[phase]
          const list = templates.filter((template) => template.phase === phase)
          if (list.length === 0) return null

          return (
            <div key={phase} className="mb-3 rounded-xl border border-trait bg-carte p-3">
              <h3 className={`panneau flex items-center gap-2 text-sm ${style.ink}`}>
                <span aria-hidden className={`h-4 w-1.5 rounded-full ${style.rail}`} />
                {PHASE_LABELS[phase as Phase]}
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {list.map((template) => (
                  <li key={template.id} className="flex items-center justify-between gap-3 rounded-lg border border-trait p-2">
                    <span className="text-sm">
                      <strong>{template.title}</strong>
                      <span className="text-encre-douce"> · {DIFFICULTY_LABELS[template.difficulty as Difficulty]}</span>
                    </span>
                    <ActionButton
                      action={createFromTemplateAction.bind(null, template.id)}
                      className="panneau shrink-0 rounded-lg border border-accent px-3 py-1 text-sm text-accent-encre"
                    >
                      Ajouter
                    </ActionButton>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </section>

      <section>
        <h2 className="panneau-titre mb-2 text-lg">Ajouter un modèle au catalogue</h2>
        <TemplateForm />
      </section>
    </div>
  )
}
