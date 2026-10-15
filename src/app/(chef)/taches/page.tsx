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
      <h1 className="text-2xl font-bold">Créer des tâches</h1>

      <section>
        <h2 className="mb-2 text-lg font-bold">Nouvelle tâche</h2>
        <NewTaskForm isChef />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Catalogue de tâches types</h2>
        <p className="mb-3 text-sm opacity-70">Un clic suffit pour l&apos;ajouter au CAP en cours.</p>

        {PHASES.map((phase) => {
          const style = PHASE_STYLES[phase]
          const list = templates.filter((template) => template.phase === phase)
          if (list.length === 0) return null

          return (
            <div key={phase} className={`mb-3 rounded-2xl p-3 ${style.bg} ${style.text}`}>
              <h3 className="font-bold">
                <span aria-hidden>{style.emoji}</span> {PHASE_LABELS[phase as Phase]}
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {list.map((template) => (
                  <li key={template.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/80 p-2 dark:bg-stone-900/80">
                    <span className="text-sm">
                      <strong>{template.title}</strong>
                      <span className="opacity-70"> · {DIFFICULTY_LABELS[template.difficulty as Difficulty]}</span>
                    </span>
                    <ActionButton
                      action={createFromTemplateAction.bind(null, template.id)}
                      className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1 text-sm font-semibold text-white"
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
        <h2 className="mb-2 text-lg font-bold">Ajouter un modèle au catalogue</h2>
        <TemplateForm />
      </section>
    </div>
  )
}
