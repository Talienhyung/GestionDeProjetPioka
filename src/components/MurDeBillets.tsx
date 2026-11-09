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
    <div className="flex flex-col gap-4">
      {modifiable ? <BilletForm projectId={projectId} /> : null}

      <div className="tableau-liege rounded-2xl border border-trait px-3 pt-4 pb-1">
        {notes.length === 0 ? (
          <p className="pb-4 text-center text-sm text-encre-douce">
            Le tableau est vide{modifiable ? ' : à toi d’écrire le premier billet.' : '.'}
          </p>
        ) : (
          <div className="columns-2 gap-3 sm:columns-3">
            {notes.map((note) => (
              <Billet
                key={note.id}
                note={note}
                projectId={projectId}
                currentUserId={currentUserId}
                isChef={isChef}
                modifiable={modifiable}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
