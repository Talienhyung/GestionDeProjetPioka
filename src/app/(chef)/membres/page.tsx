import { PageHeader } from '@/components/PageHeader'
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
      <PageHeader
        picto="visage"
        surtitre="Gestion"
        titre="Les jeunes"
        retour={{ href: '/profil', label: 'Profil' }}
        description="Un mot de passe oublié ? Génère-en un nouveau : il devra le changer à sa prochaine connexion."
      />

      {membres.length === 0 ? (
        <p className="text-sm text-encre-douce">Aucun compte jeune pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {membres.map((membre) => (
            <li key={membre.id} className="flex items-center justify-between gap-3 rounded-xl border border-trait p-3">
              <span className="text-sm">
                <strong>{membre.displayName}</strong>
                <span className="block text-encre-douce">{membre.username}</span>
              </span>
              <ActionButton
                action={resetPasswordAction.bind(null, membre.id)}
                className="shrink-0 rounded-lg border border-trait px-3 py-2 text-sm"
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
