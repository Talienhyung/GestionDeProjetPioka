import Link from 'next/link'

type Onglet = 'tableau' | 'roles' | 'classement'

const ONGLETS: { cle: Onglet; label: string; chemin: string }[] = [
  { cle: 'tableau', label: 'Tableau', chemin: '' },
  { cle: 'roles', label: 'Rôles', chemin: '/roles' },
  { cle: 'classement', label: 'Classement', chemin: '/classement' },
]

/** Navigation interne à un CAP : on reste dans le même projet. */
export function OngletsProjet({ projectId, actif }: { projectId: string; actif: Onglet }) {
  return (
    <nav className="flex gap-1 rounded-lg border border-trait bg-carte p-1">
      {ONGLETS.map((onglet) => (
        <Link
          key={onglet.cle}
          href={`/cap/${projectId}${onglet.chemin}`}
          className={`panneau flex-1 rounded px-2 py-1.5 text-center text-xs ${
            onglet.cle === actif ? 'bg-bouton text-sur-bouton' : 'text-encre-douce'
          }`}
        >
          {onglet.label}
        </Link>
      ))}
    </nav>
  )
}
