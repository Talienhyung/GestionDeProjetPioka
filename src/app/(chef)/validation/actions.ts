// src/app/(chef)/validation/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import { reviewSubmission } from '@/lib/services/submissionService'
import { decideProposal } from '@/lib/services/taskService'

export async function reviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const chef = await requireChef()
  const submissionId = String(formData.get('submissionId') ?? '')
  const accept = formData.get('decision') === 'ACCEPTEE'

  try {
    const result = await reviewSubmission(db, chef, {
      submissionId,
      decision: accept ? 'ACCEPTEE' : 'REFUSEE',
      comment: String(formData.get('comment') ?? ''),
      bonus: Number(formData.get('bonus') ?? 0),
    })
    revalidatePath('/validation')
    revalidatePath('/cap')
    return {
      success: accept
        ? `Validée ! ${result.awarded.length} jeune(s) crédité(s) de ${result.awarded[0]?.amount ?? 0} points.`
        : 'Renvoyée au jeune pour correction.',
    }
  } catch (error) {
    return toFormError(error)
  }
}

export async function proposalAction(taskId: string, accept: boolean): Promise<FormState> {
  const chef = await requireChef()
  try {
    await decideProposal(db, chef, taskId, accept)
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/validation')
  revalidatePath('/cap')
  return { success: accept ? 'Proposition acceptée.' : 'Proposition écartée.' }
}
