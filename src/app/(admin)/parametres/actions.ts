// src/app/(admin)/parametres/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireSuperAdmin } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import { ValidationError } from '@/lib/services/errors'
import { setScale } from '@/lib/services/settingsService'

export async function setScaleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSuperAdmin()
  const read = (key: string) => Math.round(Number(formData.get(key) ?? 0))
  const scale = { FACILE: read('FACILE'), MOYEN: read('MOYEN'), DIFFICILE: read('DIFFICILE') }

  try {
    if (Object.values(scale).some((v) => !Number.isInteger(v) || v <= 0)) {
      throw new ValidationError('Chaque valeur du barème doit être un entier supérieur à zéro.')
    }
    await setScale(db, scale)
  } catch (error) {
    return toFormError(error)
  }

  revalidatePath('/parametres')
  return { success: 'Barème enregistré. Les tâches déjà validées gardent leurs points.' }
}
