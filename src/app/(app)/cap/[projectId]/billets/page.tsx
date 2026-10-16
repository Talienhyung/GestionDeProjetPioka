import { MurDeBillets } from '@/components/MurDeBillets'
import { OngletsProjet } from '@/components/OngletsProjet'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { isChef } from '@/lib/domain/types'
import { listNotes } from '@/lib/services/noteService'
import { getVisibleProject } from '@/lib/services/projectService'

export default async function BilletsProjetPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireUser()
  const { projectId } = await params
  const project = await getVisibleProject(db, user, projectId)
  const notes = await listNotes(db, project.id)

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="panneau-titre text-3xl">Billets</h1>
        <p className="text-sm text-encre-douce">{project.title}</p>
      </header>

      <OngletsProjet projectId={project.id} actif="billets" />

      <MurDeBillets
        notes={notes}
        projectId={project.id}
        currentUserId={user.id}
        isChef={isChef(user)}
        modifiable={project.status !== 'ARCHIVE'}
      />
    </div>
  )
}
