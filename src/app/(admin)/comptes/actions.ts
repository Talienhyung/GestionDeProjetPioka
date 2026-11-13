// src/app/(admin)/comptes/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { requireSuperAdmin } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { type FormState, toFormError } from '@/lib/formState'
import type { AppRole } from '@/lib/domain/types'
import { bandesConnexionPdf } from '@/lib/pdf/bandesConnexion'
import { deletePhoto } from '@/lib/storage'
import { type NouveauJeune, createJeunes, createUser, deleteUser, setActive } from '@/lib/services/userService'

export async function createUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireSuperAdmin()
  try {
    const { user, tempPassword } = await createUser(db, admin, {
      username: String(formData.get('username') ?? ''),
      displayName: String(formData.get('displayName') ?? ''),
      role: String(formData.get('role') ?? 'JEUNE') as AppRole,
    })
    revalidatePath('/comptes')
    // Le mot de passe provisoire n'est affiché qu'ici, une seule fois.
    return { success: `Compte « ${user.username} » créé. Mot de passe provisoire : ${tempPassword}` }
  } catch (error) {
    return toFormError(error)
  }
}

export async function setActiveAction(userId: string, active: boolean): Promise<FormState> {
  const admin = await requireSuperAdmin()
  try {
    await setActive(db, admin, userId, active)
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/comptes')
  return { success: active ? 'Compte réactivé.' : 'Compte désactivé.' }
}

/** L'adresse du site telle que le navigateur l'a appelée : c'est elle qu'on met dans le QR code. */
async function urlDuSite(): Promise<string> {
  if (process.env.PUBLIC_SITE_URL) return process.env.PUBLIC_SITE_URL
  const h = await headers()
  const hote = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (hote.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${hote}`
}

export interface LotState {
  error?: string
  crees?: NouveauJeune[]
  /** Le PDF des bandes à découper, en base64 : les mots de passe n'existent plus ailleurs. */
  pdf?: string
}

export async function createJeunesAction(_prev: LotState, formData: FormData): Promise<LotState> {
  const admin = await requireSuperAdmin()
  try {
    const crees = await createJeunes(
      db,
      admin,
      String(formData.get('noms') ?? ''),
      String(formData.get('groupeId') ?? '') || null,
    )
    const pdf = await bandesConnexionPdf(crees, await urlDuSite())
    revalidatePath('/comptes')
    return { crees, pdf: Buffer.from(pdf).toString('base64') }
  } catch (error) {
    return toFormError(error)
  }
}

export async function deleteUserAction(userId: string): Promise<FormState> {
  const admin = await requireSuperAdmin()
  try {
    const fichiers = await deleteUser(db, admin, userId)
    // Après la base : une image orpheline ne gêne personne, l'inverse si.
    await Promise.all(fichiers.map((f) => deletePhoto(f).catch(() => undefined)))
  } catch (error) {
    return toFormError(error)
  }
  revalidatePath('/comptes')
  revalidatePath('/membres')
  return { success: 'Compte supprimé.' }
}
