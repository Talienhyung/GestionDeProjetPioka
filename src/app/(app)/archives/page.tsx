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
        <h1 className="text-2xl font-bold">Les CAP précédents</h1>
        <p className="text-sm opacity-70">
          Tout ce qui a été fait reste consultable, mais plus modifiable.
        </p>
      </header>

      {projets.length === 0 ? (
        <p className="text-sm opacity-70">Aucun CAP archivé pour l’instant.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {projets.map((projet) => (
            <li key={projet.id}>
              <Link
                href={`/archives/${projet.id}`}
                className="block rounded-xl border bg-white p-3 dark:bg-stone-900"
              >
                <strong>{projet.title}</strong>
                <span className="block text-sm opacity-70">
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
