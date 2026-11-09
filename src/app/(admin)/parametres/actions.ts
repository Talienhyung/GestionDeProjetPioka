// src/app/(admin)/parametres/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireSuperAdmin } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { parseEuros } from '@/lib/domain/money'
import { GOALS_MAX, GOAL_LABEL_MAX, type StretchGoal } from '@/lib/domain/stretchGoals'
import { type FormState, toFormError } from '@/lib/formState'
import { ValidationError } from '@/lib/services/errors'
import { setScale, setStretchGoals } from '@/lib/services/settingsService'

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

export async function setStretchGoalsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSuperAdmin()
  const amounts = formData.getAll('amount').map(String)
  const labels = formData.getAll('label').map(String)

  try {
    const goals: StretchGoal[] = []
    amounts.forEach((saisie, i) => {
      const label = (labels[i] ?? '').trim()
      if (!saisie.trim() && !label) return // ligne laissée vide
      const amountCents = parseEuros(saisie)
      if (amountCents === null || amountCents <= 0) {
        throw new ValidationError(`Palier ${i + 1} : le montant doit être un nombre d’euros positif.`)
      }
      if (!label) throw new ValidationError(`Palier ${i + 1} : donne-lui un nom (ce qu’il permet d’offrir).`)
      if (label.length > GOAL_LABEL_MAX) {
        throw new ValidationError(`Palier ${i + 1} : le nom ne peut pas dépasser ${GOAL_LABEL_MAX} caractères.`)
      }
      goals.push({ amountCents, label })
    })
    if (goals.length > GOALS_MAX) throw new ValidationError(`Pas plus de ${GOALS_MAX} paliers.`)
    if (new Set(goals.map((g) => g.amountCents)).size !== goals.length) {
      throw new ValidationError('Deux paliers ont le même montant.')
    }
    await setStretchGoals(db, goals)
  } catch (error) {
    return toFormError(error)
  }

  revalidatePath('/parametres')
  revalidatePath('/accueil')
  return { success: 'Paliers enregistrés : ils apparaissent sur la barre des récoltes.' }
}
