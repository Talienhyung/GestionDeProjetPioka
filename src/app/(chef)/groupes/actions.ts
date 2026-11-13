// src/app/(chef)/groupes/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import { createGroupe, deleteGroupe, setGroupe, updateGroupe } from '@/lib/services/groupeService'

function rafraichir() {
  revalidatePath('/groupes')
  revalidatePath('/membres')
}

const champs = (formData: FormData) => ({
  name: String(formData.get('name') ?? ''),
  color: String(formData.get('color') ?? '') || null,
})

export async function createGroupeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const chef = await requireChef()
  try {
    const g = await createGroupe(db, chef, champs(formData))
    rafraichir()
    return { success: `Groupe « ${g.name} » créé.` }
  } catch (error) {
    return toFormError(error)
  }
}

export async function updateGroupeAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const chef = await requireChef()
  try {
    await updateGroupe(db, chef, id, champs(formData))
  } catch (error) {
    return toFormError(error)
  }
  rafraichir()
  return { success: 'Enregistré.' }
}

export async function deleteGroupeAction(id: string): Promise<FormState> {
  const chef = await requireChef()
  try {
    await deleteGroupe(db, chef, id)
  } catch (error) {
    return toFormError(error)
  }
  rafraichir()
  return { success: 'Groupe supprimé.' }
}

export async function setGroupeAction(userId: string, groupeId: string | null): Promise<FormState> {
  const chef = await requireChef()
  try {
    await setGroupe(db, chef, userId, groupeId)
  } catch (error) {
    return toFormError(error)
  }
  rafraichir()
  return {}
}
