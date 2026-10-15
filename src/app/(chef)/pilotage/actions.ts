// src/app/(chef)/pilotage/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import type { Phase } from '@/lib/domain/types'
import { archiveProject, createProject, getActiveProject, setPhase } from '@/lib/services/projectService'
import { notifyMany } from '@/lib/services/notificationService'
import { NotFoundError } from '@/lib/services/errors'

export async function setPhaseAction(phase: Phase): Promise<FormState> {
  const chef = await requireChef()
  try {
    const project = await getActiveProject(db)
    if (!project) throw new NotFoundError('CAP en cours')
    await setPhase(db, chef, project.id, phase)

    const jeunes = await db.user.findMany({ where: { role: 'JEUNE', isActive: true }, select: { id: true } })
    await notifyMany(db, jeunes.map((j) => j.id), {
      type: 'PHASE',
      message: `Le CAP passe en phase ${phase.toLowerCase()} !`,
      link: '/cap',
    })
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/cap')
  revalidatePath('/pilotage')
  return { success: 'Phase mise à jour.' }
}

export async function archiveAction(): Promise<FormState> {
  const chef = await requireChef()
  try {
    const project = await getActiveProject(db)
    if (!project) throw new NotFoundError('CAP en cours')
    await archiveProject(db, chef, project.id)
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/cap')
  revalidatePath('/pilotage')
  return { success: 'CAP archivé. Il reste consultable, mais plus modifiable.' }
}

export async function newProjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const chef = await requireChef()
  try {
    const current = await getActiveProject(db)
    if (current) await archiveProject(db, chef, current.id)

    await createProject(db, chef, {
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? ''),
    })
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/cap')
  revalidatePath('/pilotage')
  return { success: 'Nouveau CAP démarré !' }
}
