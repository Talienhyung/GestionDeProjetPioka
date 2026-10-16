import { Billet } from '@/components/Billet'
import { BilletForm } from '@/components/BilletForm'

interface Props {
  notes: Parameters<typeof Billet>[0]['note'][]
  projectId: string | null
  currentUserId: string
  isChef: boolean
  /** Un CAP archivé se lit, ne s'écrit plus. */
  modifiable: boolean
}

export function MurDeBillets({ notes, projectId, currentUserId, isChef, modifiable }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {modifiable ? <BilletForm projectId={projectId} /> : null}

      {notes.length === 0 ? (
        <p className="text-sm text-encre-douce">
          Le tableau est vide{modifiable ? ' : à toi d’écrire le premier billet.' : '.'}
        </p>
      ) : (
        notes.map((note) => (
          <Billet
            key={note.id}
            note={note}
            projectId={projectId}
            currentUserId={currentUserId}
            isChef={isChef}
            modifiable={modifiable}
          />
        ))
      )}
    </div>
  )
}
