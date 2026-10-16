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
      <header>
        <h1 className="panneau-titre text-3xl">Le tableau</h1>
        <p className="text-sm text-encre-douce">
          Le tableau d’affichage de la caravane : idées, rappels, listes. Chacun écrit, chacun gère ses billets.
        </p>
      </header>

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
