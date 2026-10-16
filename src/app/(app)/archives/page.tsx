import Link from 'next/link'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { listProjects } from '@/lib/services/projectService'

export default async function ArchivesPage() {
  await requireUser()
  const projets = (await listProjects(db)).filter((projet) => projet.status === 'ARCHIVE')

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="panneau-titre text-3xl">Les CAP précédents</h1>
        <p className="text-sm text-encre-douce">
          Tout ce qui a été fait reste consultable, mais plus modifiable.
        </p>
      </header>

      {projets.length === 0 ? (
        <p className="text-sm text-encre-douce">Aucun CAP archivé pour l’instant.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {projets.map((projet) => (
            <li key={projet.id}>
              <Link
                href={`/archives/${projet.id}`}
                className="block rounded-xl border border-trait bg-carte p-3"
              >
                <strong>{projet.title}</strong>
                <span className="block text-sm text-encre-douce">
                  {projet.startedAt.toLocaleDateString('fr-FR')}
                  {projet.archivedAt ? ` — ${projet.archivedAt.toLocaleDateString('fr-FR')}` : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
