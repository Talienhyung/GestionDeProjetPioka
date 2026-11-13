import { PageHeader } from '@/components/PageHeader'
import type { ReactNode } from 'react'
import { notFound, redirect } from 'next/navigation'
import { OngletsProjet } from '@/components/OngletsProjet'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { formatEuros } from '@/lib/domain/money'
import { PHASES, type Phase } from '@/lib/domain/types'
import { NotFoundError } from '@/lib/services/errors'
import { totalForProject } from '@/lib/services/extraJobService'
import { getVisibleProject } from '@/lib/services/projectService'
import { couvertureUrl } from '@/lib/ui/apparenceBadge'
import { PHASE_STYLES } from '@/lib/ui/phases'

/**
 * Coquille commune à toutes les pages d'un CAP : un en-tête compact (retour,
 * titre, où on en est) et des onglets collants. Chaque page n'a plus qu'à
 * montrer son contenu.
 */
export default async function CapLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ projectId: string }>
}) {
  const user = await requireUser()
  const { projectId } = await params

  let project
  try {
    project = await getVisibleProject(db, user, projectId)
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error
    // Compatibilité : les notifications envoyées avant la mise en place des
    // CAP multiples pointaient sur /cap/<tâche>. On redirige vers l'adresse
    // actuelle plutôt que de rendre ces liens morts.
    const task = await db.task.findUnique({ where: { id: projectId }, select: { id: true, projectId: true } })
    if (!task) notFound()
    redirect(`/cap/${task.projectId}/tache/${task.id}`)
  }

  const cagnotte = await totalForProject(db, project.id)
  const phase = project.currentPhase as Phase
  const style = PHASE_STYLES[phase]
  const etape = PHASES.indexOf(phase) + 1
  const couverture = couvertureUrl(project)

  return (
    <div className="flex flex-col gap-3">
      {/* En-tête volontairement léger : le titre, et une ligne d'état en texte simple. */}
      <PageHeader
        titre={project.title}
        retour={{ href: '/cap', label: 'Nos CAP' }}
        description={[
          project.status === 'BROUILLON'
            ? 'Brouillon, invisible des jeunes'
            : project.status === 'ARCHIVE'
              ? `Archivé le ${project.archivedAt?.toLocaleDateString('fr-FR')}`
              : `Étape ${etape}/3 · ${style.label}`,
          cagnotte > 0 ? `${formatEuros(cagnotte)} récoltés` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      >
        {couverture ? (
          // La couverture en bandeau, sous le titre : présente sans prendre la page.
          <div className="mt-1 h-20 overflow-hidden rounded-xl bg-surface-haute sm:h-28">
            {/* eslint-disable-next-line @next/next/no-img-element -- image privée servie par l'API, après session */}
            <img src={couverture} alt="" className="size-full object-cover" />
          </div>
        ) : null}
      </PageHeader>

      <OngletsProjet projectId={project.id} />

      {children}
    </div>
  )
}
