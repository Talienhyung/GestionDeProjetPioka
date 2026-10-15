import { ActionButton } from '@/components/ActionButton'
import { RoleForm } from '@/components/RoleForm'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { isChef } from '@/lib/domain/types'
import { getActiveProject } from '@/lib/services/projectService'
import { listRoles } from '@/lib/services/roleService'
import { applyAction, closeRoleAction, decideApplicationAction } from './actions'

export default async function RolesPage() {
  const user = await requireUser()
  const project = await getActiveProject(db)
  if (!project) return <p>Aucun CAP en cours.</p>

  const roles = await listRoles(db, project.id)
  const chef = isChef(user)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Les rôles du CAP</h1>

      {chef ? (
        <details className="rounded-2xl border p-4">
          <summary className="cursor-pointer font-semibold">Créer un rôle</summary>
          <div className="mt-3">
            <RoleForm />
          </div>
        </details>
      ) : null}

      {roles.length === 0 ? <p className="text-sm opacity-70">Aucun rôle défini pour l'instant.</p> : null}

      {roles.map((role) => (
        <article key={role.id} className="rounded-2xl border bg-white p-4 dark:bg-stone-900">
          <header className="flex items-baseline justify-between">
            <h2 className="font-bold">{role.name}</h2>
            <span className="text-sm opacity-70">{role.points} pts</span>
          </header>
          {role.description ? <p className="mt-1 text-sm">{role.description}</p> : null}

          <p className="mt-2 text-sm">
            {role.holder
              ? `Tenu par ${role.holder.displayName}${role.closedAt ? ' · clôturé' : ''}`
              : 'Personne ne tient ce rôle pour l\'instant.'}
          </p>

          {!role.holder && !chef ? (
            <div className="mt-3">
              <ActionButton
                action={applyAction.bind(null, role.id)}
                className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white"
              >
                Je me porte candidat
              </ActionButton>
            </div>
          ) : null}

          {chef && role.applications.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2">
              {role.applications.map((application) => (
                <li key={application.id} className="flex items-center justify-between gap-2 rounded-lg bg-stone-100 p-2 dark:bg-stone-800">
                  <span className="text-sm">{application.user.displayName}</span>
                  <span className="flex gap-2">
                    <ActionButton
                      action={decideApplicationAction.bind(null, role.id, application.user.id, true)}
                      className="rounded bg-emerald-600 px-3 py-1 text-sm text-white"
                    >
                      Attribuer
                    </ActionButton>
                    <ActionButton
                      action={decideApplicationAction.bind(null, role.id, application.user.id, false)}
                      className="rounded border px-3 py-1 text-sm"
                    >
                      Écarter
                    </ActionButton>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {chef && role.holder && !role.closedAt ? (
            <div className="mt-3">
              <ActionButton
                action={closeRoleAction.bind(null, role.id)}
                className="rounded-lg border px-4 py-2 text-sm"
                confirm="Clôturer ce rôle et verser les points à son titulaire ?"
              >
                Clôturer et verser les points
              </ActionButton>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  )
}
