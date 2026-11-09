import Link from 'next/link'
import { Icone } from '@/components/Icone'
import { NewTaskForm } from '@/components/NewTaskForm'
import { SentierCap } from '@/components/SentierCap'
import { TaskCard } from '@/components/TaskCard'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { isChef, type Phase } from '@/lib/domain/types'
import { getVisibleProject } from '@/lib/services/projectService'
import { getScale } from '@/lib/services/settingsService'
import { listBoard } from '@/lib/services/taskService'
import { PHASE_STYLES } from '@/lib/ui/phases'

type Tache = Awaited<ReturnType<typeof listBoard>>[Phase][number]

/**
 * Les tâches de l'étape en cours, rangées par ce qu'elles demandent : ce qui
 * est à moi, ce qui est à prendre, ce qui attend un chef, ce qui avance, et ce
 * qui est fini (replié). Les autres étapes ne s'ouvrent qu'en leur temps.
 */
export default async function CapTachesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireUser()
  const { projectId } = await params
  const project = await getVisibleProject(db, user, projectId)
  const [board, scale] = await Promise.all([listBoard(db, project.id), getScale(db)])

  const courante = project.currentPhase as Phase
  const style = PHASE_STYLES[courante]
  const chef = isChef(user)
  const peutAjouter = project.status !== 'ARCHIVE' && (chef || project.status === 'EN_COURS')

  const taches = board[courante]
  const mien = (t: Tache) => t.assignments.some((a) => a.user.id === user.id)
  const groupes: { titre: string; point: string; taches: Tache[]; aide?: string }[] = [
    {
      titre: 'À toi',
      point: 'bg-accent',
      taches: taches.filter((t) => mien(t) && t.status !== 'TERMINEE'),
    },
    {
      titre: 'À prendre',
      point: style.rail,
      taches: taches.filter((t) => t.status === 'OUVERTE' && !mien(t)),
      aide: 'Ouvre-en une pour t’inscrire',
    },
    {
      titre: 'Proposées',
      point: 'bg-partager',
      taches: taches.filter((t) => t.status === 'PROPOSEE' && !mien(t)),
      aide: chef ? 'À accepter ou refuser' : 'En attente d’un chef',
    },
    {
      titre: 'En route',
      point: 'bg-encre-douce',
      taches: taches.filter((t) => ['EN_COURS', 'SOUMISE', 'A_CORRIGER'].includes(t.status) && !mien(t)),
    },
  ]
  const terminees = taches.filter((t) => t.status === 'TERMINEE')
  const rien = groupes.every((g) => g.taches.length === 0) && terminees.length === 0

  return (
    <div className="flex flex-col gap-5">
      <SentierCap courante={courante} board={board} />

      {rien ? (
        <p className="rounded-xl border border-dashed border-trait p-6 text-center text-sm text-encre-douce">
          Pas encore de tâche dans l’étape <span className={`font-bold ${style.ink}`}>{style.label}</span>.
        </p>
      ) : null}

      {groupes
        .filter((g) => g.taches.length > 0)
        .map((g) => (
          <section key={g.titre} aria-labelledby={`groupe-${g.titre}`} className="flex flex-col gap-2">
            <h2 id={`groupe-${g.titre}`} className="flex items-center gap-2 px-1">
              <span aria-hidden className={`size-2 rounded-full ${g.point}`} />
              <span className="panneau text-[11px]">{g.titre}</span>
              <span className="text-[11px] text-encre-douce tabular-nums">{g.taches.length}</span>
              {g.aide ? <span className="truncate text-[11px] text-encre-douce">· {g.aide}</span> : null}
            </h2>
            <ul className="flex flex-col gap-2">
              {g.taches.map((t) => (
                <li key={t.id}>
                  <TaskCard
                    projectId={project.id}
                    task={t}
                    currentUserId={user.id}
                    points={scale[t.difficulty as keyof typeof scale]}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}

      {terminees.length > 0 ? (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-1 [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="size-2 rounded-full bg-ok" />
            <span className="panneau text-[11px] text-encre-douce">Terminées</span>
            <span className="text-[11px] text-encre-douce tabular-nums">{terminees.length}</span>
            <Icone nom="chevron" taille={14} className="text-encre-douce transition-transform group-open:rotate-90" />
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {terminees.map((t) => (
              <li key={t.id}>
                <TaskCard projectId={project.id} task={t} currentUserId={user.id} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {peutAjouter ? (
        <details className="px-1">
          <summary className="panneau cursor-pointer list-none text-[11px] text-accent [&::-webkit-details-marker]:hidden">
            + {chef ? 'Ajouter une tâche' : 'Proposer une tâche'}
          </summary>
          <div className="mt-3">
            <NewTaskForm isChef={chef} projectId={project.id} />
          </div>
          {chef ? (
            <Link href={`/cap/${project.id}/taches`} className="mt-3 block text-xs text-encre-douce underline">
              ou piocher dans le catalogue de tâches types
            </Link>
          ) : null}
        </details>
      ) : null}
    </div>
  )
}
