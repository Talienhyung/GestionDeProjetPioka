// src/app/(chef)/taches/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireChef, requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import type { Difficulty, Phase } from '@/lib/domain/types'
import { getActiveProject } from '@/lib/services/projectService'
import { createTask } from '@/lib/services/taskService'
import { NotFoundError, ValidationError } from '@/lib/services/errors'

/** Un chef crée une tâche ouverte ; un jeune crée une proposition. Même action. */
export async function createTaskAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser()
  try {
    const project = await getActiveProject(db)
    if (!project) throw new NotFoundError('CAP en cours')

    await createTask(db, user, {
      projectId: project.id,
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? ''),
      phase: String(formData.get('phase') ?? 'AGIR') as Phase,
      difficulty: String(formData.get('difficulty') ?? 'MOYEN') as Difficulty,
    })
  } catch (error) {
    return toFormError(error)
  }

  revalidatePath('/cap')
  revalidatePath('/taches')
  return { success: 'Tâche enregistrée.' }
}

export async function createFromTemplateAction(templateId: string): Promise<FormState> {
  const chef = await requireChef()
  try {
    const [template, project] = await Promise.all([
      db.taskTemplate.findUnique({ where: { id: templateId } }),
      getActiveProject(db),
    ])
    if (!template) throw new NotFoundError('Modèle')
    if (!project) throw new NotFoundError('CAP en cours')

    await createTask(db, chef, {
      projectId: project.id,
      title: template.title,
      description: template.description,
      phase: template.phase as Phase,
      difficulty: template.difficulty as Difficulty,
    })
  } catch (error) {
    return toFormError(error)
  }

  revalidatePath('/cap')
  return { success: 'Tâche ajoutée au CAP.' }
}

export async function saveAsTemplateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireChef()
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return toFormError(new ValidationError('Le titre est obligatoire.'))

  await db.taskTemplate.create({
    data: {
      title,
      description: String(formData.get('description') ?? ''),
      phase: String(formData.get('phase') ?? 'AGIR'),
      difficulty: String(formData.get('difficulty') ?? 'MOYEN'),
      isBuiltin: false,
    },
  })

  revalidatePath('/taches')
  return { success: 'Modèle enregistré, tu le retrouveras au prochain CAP.' }
}
