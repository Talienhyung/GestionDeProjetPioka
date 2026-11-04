'use server'

import { revalidatePath } from 'next/cache'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { parseEuros } from '@/lib/domain/money'
import { type FormState, toFormError } from '@/lib/formState'
import { createExtraJob, deleteExtraJob } from '@/lib/services/extraJobService'

function rafraichir() {
  revalidatePath('/extra-jobs')
  revalidatePath('/accueil')
  revalidatePath('/cap', 'layout')
}

/** Le formulaire porte un champ `montant-<projectId>` par CAP ; vide = rien pour ce CAP. */
export async function newExtraJobAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const chef = await requireChef()

  const shares: { projectId: string; amountCents: number }[] = []
  for (const [cle, valeur] of formData.entries()) {
    if (!cle.startsWith('montant-') || String(valeur).trim() === '') continue
    const amountCents = parseEuros(String(valeur))
    if (amountCents === null) return { error: `Montant illisible : « ${String(valeur)} ». Écris par exemple 12,50.` }
    if (amountCents > 0) shares.push({ projectId: cle.slice('montant-'.length), amountCents })
  }

  try {
    await createExtraJob(db, chef, {
      title: String(formData.get('title') ?? ''),
      doneOn: new Date(String(formData.get('doneOn') ?? '')),
      workerIds: formData.getAll('workerIds').map(String),
      shares,
    })
  } catch (error) {
    return toFormError(error)
  }
  rafraichir()
  return { success: 'Extra job enregistré.' }
}

export async function deleteExtraJobAction(extraJobId: string): Promise<FormState> {
  const chef = await requireChef()
  try {
    await deleteExtraJob(db, chef, extraJobId)
  } catch (error) {
    return toFormError(error)
  }
  rafraichir()
  return { success: 'Extra job supprimé.' }
}
