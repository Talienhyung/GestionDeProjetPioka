import { Billet } from '@/components/Billet'
import { NouveauBillet } from '@/components/NouveauBillet'

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
      <div className="tableau-liege rounded-2xl border border-trait px-3 pt-4 pb-3">
        {notes.length === 0 ? (
          <p className="pb-4 text-center text-sm text-encre-douce">
            Le tableau est vide{modifiable ? ' : touche le + pour écrire le premier billet.' : '.'}
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

        {/* Le + vit dans le coin bas droit du tableau ; sur un long tableau, il
            reste collé au bas de l'écran, au-dessus de la barre de navigation. */}
        {modifiable ? (
          <div className="pointer-events-none sticky bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-10 mt-1 flex justify-end">
            <NouveauBillet projectId={projectId} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
