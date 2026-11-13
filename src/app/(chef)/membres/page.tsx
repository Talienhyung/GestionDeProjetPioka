import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { ActionButton } from '@/components/ActionButton'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { listMembers } from '@/lib/services/userService'
import { resetPasswordAction } from './actions'

export default async function MembresPage() {
  await requireChef()
  const [tous, groupes] = await Promise.all([listMembers(db), db.groupe.findMany({ orderBy: { name: 'asc' } })])
  const groupeDe = new Map(groupes.map((g) => [g.id, g]))
  // Par groupe (dans l'ordre des noms), les jeunes sans groupe à la fin.
  const rang = (id: string | null) => (id && groupeDe.has(id) ? groupes.findIndex((g) => g.id === id) : groupes.length)
  const membres = tous
    .filter((membre) => membre.role === 'JEUNE' && membre.isActive)
    .sort((a, b) => rang(a.groupeId) - rang(b.groupeId))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        picto="visage"
        surtitre="Gestion"
        titre="Les jeunes"
        retour={{ href: '/profil', label: 'Profil' }}
        action={
          <Link href="/groupes" className="panneau rounded-lg border border-trait px-3 py-2 text-xs">
            Groupes
          </Link>
        }
        description="Récompense un jeune (écusson ou points), ou génère-lui un nouveau mot de passe s’il a oublié le sien."
      />

      {membres.length === 0 ? (
        <p className="text-sm text-encre-douce">Aucun compte jeune pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {membres.map((membre) => (
            <li key={membre.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-trait bg-carte p-3">
              <span className="text-sm">
                <strong>{membre.displayName}</strong>
                <span className="flex items-center gap-2 text-encre-douce">
                  {membre.username}
                  {membre.groupeId && groupeDe.has(membre.groupeId) ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-encre">
                      <span
                        aria-hidden
                        className="size-2.5 rounded-full"
                        style={{ background: groupeDe.get(membre.groupeId)?.color ?? 'var(--trait)' }}
                      />
                      {groupeDe.get(membre.groupeId)?.name}
                    </span>
                  ) : null}
                </span>
              </span>
              <span className="flex items-start gap-2">
                <ActionButton
                  action={resetPasswordAction.bind(null, membre.id)}
                  className="rounded-lg border border-trait px-3 py-2 text-sm"
                  confirm="Générer un nouveau mot de passe ? L'ancien ne marchera plus."
                >
                  Mot de passe
                </ActionButton>
                <Link
                  href={`/membres/${membre.id}`}
                  className="panneau rounded-lg bg-bouton px-3 py-2 text-sm text-sur-bouton"
                >
                  Récompenser
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
