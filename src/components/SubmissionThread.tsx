// src/components/SubmissionThread.tsx
import Image from 'next/image'

interface Submission {
  id: string
  message: string
  createdAt: Date
  decision: string | null
  reviewComment: string | null
  bonusPoints: number
  submittedBy: { displayName: string }
  reviewedBy: { displayName: string } | null
  attachments: { id: string; originalName: string; width: number; height: number }[]
}

export function SubmissionThread({ submissions }: { submissions: Submission[] }) {
  if (submissions.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-bold">Ce qui a été rendu</h3>
      {submissions.map((submission) => (
        <article key={submission.id} className="rounded-2xl border p-4">
          <p className="text-sm">
            <strong>{submission.submittedBy.displayName}</strong> ·{' '}
            {submission.createdAt.toLocaleDateString('fr-FR')}
          </p>
          {submission.message ? <p className="mt-2 whitespace-pre-wrap">{submission.message}</p> : null}

          {submission.attachments.length > 0 ? (
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {submission.attachments.map((photo) => (
                <li key={photo.id}>
                  <Image
                    src={`/api/fichiers/${photo.id}`}
                    alt={photo.originalName}
                    width={photo.width}
                    height={photo.height}
                    // L'optimiseur de Next refait la requête sans les cookies :
                    // la route protégée lui répond 401 et l'image reste cassée.
                    // Les photos sont déjà réduites à 1600 px en WebP à
                    // l'enregistrement, et cela évite une copie en clair dans
                    // le cache d'images.
                    unoptimized
                    className="h-24 w-full rounded-lg object-cover"
                  />
                </li>
              ))}
            </ul>
          ) : null}

          {submission.decision === 'ACCEPTEE' ? (
            <p className="mt-3 rounded-lg bg-emerald-100 p-2 text-sm text-emerald-900">
              ✅ Validée par {submission.reviewedBy?.displayName}
              {submission.bonusPoints > 0 ? ` · bonus de ${submission.bonusPoints} points !` : ''}
              {submission.reviewComment ? ` — ${submission.reviewComment}` : ''}
            </p>
          ) : null}

          {submission.decision === 'REFUSEE' ? (
            <p className="mt-3 rounded-lg bg-amber-100 p-2 text-sm text-amber-900">
              ✏️ À corriger, dit {submission.reviewedBy?.displayName} : {submission.reviewComment}
            </p>
          ) : null}

          {submission.decision === null ? (
            <p className="mt-3 text-sm opacity-70">⏳ En attente de la réponse d’un chef.</p>
          ) : null}
        </article>
      ))}
    </section>
  )
}
