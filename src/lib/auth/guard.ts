import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { isChef } from '@/lib/domain/types'
import { SESSION_COOKIE, readSession, type SessionUser } from './session'

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  return readSession(db, token)
}

/** Session valide exigée. Un changement de mot de passe en attente détourne vers le profil. */
export async function requireUser(options: { allowPasswordChange?: boolean } = {}): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.mustChangePassword && !options.allowPasswordChange) redirect('/profil/mot-de-passe')
  return user
}

export async function requireChef(): Promise<SessionUser> {
  const user = await requireUser()
  if (!isChef(user)) redirect('/accueil')
  return user
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== 'SUPER_ADMIN') redirect('/accueil')
  return user
}
