import { ActionButton } from '@/components/ActionButton'
import { ExtraJobForm } from '@/components/ExtraJobForm'
import { requireChef } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { formatEuros } from '@/lib/domain/money'
import { listExtraJobs } from '@/lib/services/extraJobService'
import { listProjects } from '@/lib/services/projectService'
import { listMembers } from '@/lib/services/userService'
import { deleteExtraJobAction } from './actions'

export default async function ExtraJobsPage() {
  await requireChef()
  const [membres, projets, jobs] = await Promise.all([listMembers(db), listProjects(db), listExtraJobs(db)])
  const jeunes = membres.filter((membre) => membre.role === 'JEUNE' && membre.isActive)
  const caps = projets.filter((projet) => projet.status !== 'ARCHIVE')

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="panneau-titre text-3xl">Extra jobs</h1>
        <p className="text-sm text-encre-douce">
          Note l’argent gagné par les jeunes et répartis-le entre les CAP. Les jeunes voient le total sur l’accueil.
        </p>
      </header>

      {jeunes.length === 0 || caps.length === 0 ? (
        <p className="text-sm text-encre-douce">
          Il faut au moins un jeune et un CAP non archivé pour saisir un extra job.
        </p>
      ) : (
        <details className="rounded-xl border border-trait bg-carte px-3 py-2" open={jobs.length === 0}>
          <summary className="panneau cursor-pointer text-sm">Nouvel extra job</summary>
          <div className="mt-3">
            <ExtraJobForm jeunes={jeunes} caps={caps} today={new Date().toISOString().slice(0, 10)} />
          </div>
        </details>
      )}

      <section>
        <h2 className="panneau mb-2 text-sm text-encre-douce">Déjà saisis ({jobs.length})</h2>
        {jobs.length === 0 ? <p className="text-sm text-encre-douce">Aucun extra job pour l’instant.</p> : null}
        <ul className="flex flex-col gap-2">
          {jobs.map((job) => (
            <li key={job.id} className="rounded-xl border border-trait bg-carte p-3 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <strong>{job.title}</strong>
                <span className="font-semibold tabular-nums">
                  {formatEuros(job.shares.reduce((somme, share) => somme + share.amountCents, 0))}
                </span>
              </div>
              <p className="text-xs text-encre-douce">
                le {job.doneOn.toLocaleDateString('fr-FR')} · par {job.workers.map((w) => w.user.displayName).join(', ')}
              </p>
              <ul className="mt-1 text-xs">
                {job.shares.map((share) => (
                  <li key={share.id}>
                    {formatEuros(share.amountCents)} pour {share.project.title}
                    {share.project.status === 'ARCHIVE' ? ' (archivé)' : ''}
                  </li>
                ))}
              </ul>
              <div className="mt-2">
                <ActionButton
                  action={deleteExtraJobAction.bind(null, job.id)}
                  className="rounded-lg border border-trait px-3 py-1.5 text-xs"
                  confirm="Supprimer cet extra job ? Son argent ne sera plus compté."
                >
                  Supprimer
                </ActionButton>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
