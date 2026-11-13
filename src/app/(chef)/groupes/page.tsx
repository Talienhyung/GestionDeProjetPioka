import { ChoixGroupe, ModifierGroupe, NouveauGroupe } from '@/components/Groupes'
import { PageHeader } from '@/components/PageHeader'
import { requireChef } from '@/lib/auth/guard'
import { COULEURS_CHARTE } from '@/lib/domain/badgeLook'
import { db } from '@/lib/db'
import { listGroupes } from '@/lib/services/groupeService'
import { createGroupeAction, deleteGroupeAction, setGroupeAction, updateGroupeAction } from './actions'

type Jeune = { id: string; displayName: string; username: string; groupeId: string | null }

export default async function GroupesPage() {
  await requireChef()
  const { groupes, sansGroupe } = await listGroupes(db)
  const choix = groupes.map((g) => ({ id: g.id, name: g.name }))
  // Une couleur pas encore prise, pour que chaque groupe se distingue.
  const libre = COULEURS_CHARTE.find((c) => !groupes.some((g) => g.color === c)) ?? COULEURS_CHARTE[groupes.length % COULEURS_CHARTE.length]

  const ligne = (j: Jeune) => (
    <li key={j.id} className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0 text-sm">
        <strong className="block break-words">{j.displayName}</strong>
        <span className="text-xs text-encre-douce">{j.username}</span>
      </span>
      <ChoixGroupe
        action={setGroupeAction.bind(null, j.id)}
        actuel={j.groupeId}
        groupes={choix}
        nom={j.displayName}
      />
    </li>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        picto="equipe"
        surtitre="La caravane"
        titre="Les groupes"
        retour={{ href: '/profil', label: 'Profil' }}
        description="Répartis les jeunes en groupes. Chaque jeune est dans un groupe au plus ; le changer se fait depuis la liste."
      />

      <section>
        <h2 className="panneau-titre mb-2 text-lg">Nouveau groupe</h2>
        <NouveauGroupe key={libre} action={createGroupeAction} couleur={libre} />
      </section>

      {groupes.map((g) => (
        <section
          key={g.id}
          className="overflow-hidden rounded-2xl border border-trait bg-carte"
          style={{ borderTop: `6px solid ${g.color ?? 'var(--trait)'}` }}
        >
          <div className="flex items-start justify-between gap-3 px-4 pt-3">
            <div>
              <h2 className="brush text-3xl leading-tight">{g.name}</h2>
              <p className="panneau text-[11px] text-encre-douce tabular-nums">
                {g.membres.length} jeune{g.membres.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="px-4 pt-2 pb-1">
            <ModifierGroupe
              action={updateGroupeAction.bind(null, g.id)}
              supprimer={deleteGroupeAction.bind(null, g.id)}
              nom={g.name}
              couleur={g.color}
              membres={g.membres.length}
            />
          </div>
          {g.membres.length > 0 ? (
            <ul className="divide-y divide-trait px-4 pb-2">{g.membres.map(ligne)}</ul>
          ) : (
            <p className="px-4 pb-4 text-sm text-encre-douce">Personne pour l&apos;instant : choisis un groupe pour un jeune ci-dessous.</p>
          )}
        </section>
      ))}

      <section className="rounded-2xl border border-dashed border-trait p-4">
        <h2 className="panneau-titre text-lg">Sans groupe</h2>
        {sansGroupe.length > 0 ? (
          <ul className="divide-y divide-trait">{sansGroupe.map(ligne)}</ul>
        ) : (
          <p className="mt-1 text-sm text-encre-douce">Tous les jeunes ont un groupe.</p>
        )}
      </section>
    </div>
  )
}
