import { ActionButton } from '@/components/ActionButton'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { listMembers } from '@/lib/services/userService'
import { resetPasswordAction } from './actions'

export default async function MembresPage() {
  await requireChef()
  const membres = (await listMembers(db)).filter((membre) => membre.role === 'JEUNE' && membre.isActive)

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold">Les jeunes</h1>
        <p className="text-sm opacity-70">
          Un jeune a oublié son mot de passe ? Génère-lui-en un nouveau, il devra le changer à sa prochaine connexion.
        </p>
      </header>

      {membres.length === 0 ? (
        <p className="text-sm opacity-70">Aucun compte jeune pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {membres.map((membre) => (
            <li key={membre.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <span className="text-sm">
                <strong>{membre.displayName}</strong>
                <span className="block opacity-70">{membre.username}</span>
              </span>
              <ActionButton
                action={resetPasswordAction.bind(null, membre.id)}
                className="shrink-0 rounded-lg border px-3 py-2 text-sm"
                confirm="Générer un nouveau mot de passe ? L'ancien ne marchera plus."
              >
                Nouveau mot de passe
              </ActionButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
