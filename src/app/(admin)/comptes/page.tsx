import { PageHeader } from '@/components/PageHeader'
import { ActionButton } from '@/components/ActionButton'
import { AjoutJeunes } from '@/components/AjoutJeunes'
import { CreateUserForm } from '@/components/CreateUserForm'
import { SupprimerCompte } from '@/components/SupprimerCompte'
import { requireSuperAdmin } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import type { AppRole } from '@/lib/domain/types'
import { listMembers } from '@/lib/services/userService'
import { deleteUserAction, setActiveAction } from './actions'

const ROLE_LABELS: Record<AppRole, string> = { JEUNE: 'Jeune', CHEF: 'Chef', SUPER_ADMIN: 'Super admin' }

export default async function ComptesPage() {
  const admin = await requireSuperAdmin()
  const [membres, groupes] = await Promise.all([
    listMembers(db),
    db.groupe.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader picto="equipe" surtitre="Administration" titre="Les comptes" retour={{ href: '/profil', label: 'Profil' }} description="Crée les comptes des jeunes en lot, avec un PDF à imprimer et découper. Les mots de passe provisoires ne s’affichent qu’une fois." />

      <section>
        <h2 className="panneau-titre mb-2 text-lg">Ajouter des jeunes</h2>
        <AjoutJeunes groupes={groupes} />
      </section>

      <details className="group rounded-xl border border-trait">
        <summary className="panneau cursor-pointer p-3 text-sm marker:text-accent">Créer un seul compte (chef, admin…)</summary>
        <div className="px-3 pb-3">
          <CreateUserForm />
        </div>
      </details>

      <section>
        <h2 className="panneau-titre mb-2 text-lg">Comptes existants ({membres.length})</h2>
        <ul className="flex flex-col gap-2">
          {membres.map((membre) => (
            <li
              key={membre.id}
              className={`flex items-center justify-between gap-3 rounded-xl border border-trait p-3 ${membre.isActive ? '' : 'opacity-60'}`}
            >
              <span className="text-sm">
                <strong>{membre.displayName}</strong>
                <span className="block text-encre-douce">
                  {membre.username} · {ROLE_LABELS[membre.role as AppRole]}
                  {membre.isActive ? '' : ' · désactivé'}
                  {membre.mustChangePassword ? ' · mot de passe à changer' : ''}
                </span>
              </span>

              {membre.id === admin.id ? (
                <span className="text-xs text-encre-douce">c&apos;est toi</span>
              ) : (
                <span className="flex shrink-0 items-center gap-1">
                  <ActionButton
                    action={setActiveAction.bind(null, membre.id, !membre.isActive)}
                    className="rounded-lg border border-trait px-3 py-2 text-sm"
                    confirm={membre.isActive ? 'Désactiver ce compte ? Ses sessions seront coupées.' : undefined}
                  >
                    {membre.isActive ? 'Désactiver' : 'Réactiver'}
                  </ActionButton>
                  <SupprimerCompte
                    nom={membre.displayName}
                    desactiver={membre.isActive ? setActiveAction.bind(null, membre.id, false) : null}
                    supprimer={deleteUserAction.bind(null, membre.id)}
                  />
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
