import { PageHeader } from '@/components/PageHeader'
import { MurDeBillets } from '@/components/MurDeBillets'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { isChef } from '@/lib/domain/types'
import { listNotes } from '@/lib/services/noteService'

/** Le tableau de la caravane : ce qui ne tient à aucun projet en particulier. */
export default async function TableauPage() {
  const user = await requireUser()
  const notes = await listNotes(db, null)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        picto="drapeau"
        surtitre="La caravane"
        titre="Le tableau"
        description="Idées, rappels, listes : chacun écrit, chacun gère ses billets."
      />

      <MurDeBillets
        notes={notes}
        projectId={null}
        currentUserId={user.id}
        isChef={isChef(user)}
        modifiable
      />
    </div>
  )
}
