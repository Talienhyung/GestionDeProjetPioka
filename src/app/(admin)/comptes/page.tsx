import { ActionButton } from '@/components/ActionButton'
import { CreateUserForm } from '@/components/CreateUserForm'
import { requireSuperAdmin } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import type { AppRole } from '@/lib/domain/types'
import { listMembers } from '@/lib/services/userService'
import { setActiveAction } from './actions'

const ROLE_LABELS: Record<AppRole, string> = { JEUNE: 'Jeune', CHEF: 'Chef', SUPER_ADMIN: 'Super admin' }

export default async function ComptesPage() {
  const admin = await requireSuperAdmin()
  const membres = await listMembers(db)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Les comptes</h1>

      <section>
        <h2 className="mb-2 text-lg font-bold">Créer un compte</h2>
        <CreateUserForm />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Comptes existants ({membres.length})</h2>
        <ul className="flex flex-col gap-2">
          {membres.map((membre) => (
            <li
              key={membre.id}
              className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${membre.isActive ? '' : 'opacity-60'}`}
            >
              <span className="text-sm">
                <strong>{membre.displayName}</strong>
                <span className="block opacity-70">
                  {membre.username} · {ROLE_LABELS[membre.role as AppRole]}
                  {membre.isActive ? '' : ' · désactivé'}
                  {membre.mustChangePassword ? ' · mot de passe à changer' : ''}
                </span>
              </span>

              {membre.id === admin.id ? (
                <span className="text-xs opacity-70">c&apos;est toi</span>
              ) : (
                <ActionButton
                  action={setActiveAction.bind(null, membre.id, !membre.isActive)}
                  className="shrink-0 rounded-lg border px-3 py-2 text-sm"
                  confirm={membre.isActive ? 'Désactiver ce compte ? Ses sessions seront coupées.' : undefined}
                >
                  {membre.isActive ? 'Désactiver' : 'Réactiver'}
                </ActionButton>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
