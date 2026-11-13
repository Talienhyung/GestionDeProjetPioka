import { type EtapeVue, RouteParcours } from '@/components/RouteParcours'
import { PictoMasque } from '@/components/sgdf/PictoMasque'
import { requireUser } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { bilanParcours, etapeDeDepart } from '@/lib/domain/parcours'
import { getParcours } from '@/lib/services/parcoursService'
import { apparenceBadge } from '@/lib/ui/apparenceBadge'

export default async function ParcoursPage() {
  const user = await requireUser()
  const etapes = await getParcours(db, user)

  const idsBadges = etapes.flatMap((e) => (e.badgeId ? [e.badgeId] : []))
  const badges = idsBadges.length ? await db.badge.findMany({ where: { id: { in: idsBadges } } }) : []
  const apparences = new Map(badges.map((b) => [b.id, apparenceBadge(b)]))

  const vues: EtapeVue[] = etapes.map((e) => ({
    cle: e.cle,
    genre: e.genre,
    date: e.date.toISOString(),
    titre: e.titre,
    detail: e.detail,
    points: e.points,
    cumul: e.cumul,
    lien: e.lien,
    badge: e.badgeId ? apparences.get(e.badgeId) : undefined,
  }))
  const bilan = bilanParcours(etapes)
  const prenom = user.displayName.split(' ')[0]

  return (
    // Hauteur de l'écran moins la barre du bas : pas de défilement de page,
    // c'est la route qui défile, de côté.
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[34rem] flex-col gap-4">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="panneau text-[10px] text-encre-douce">Ton parcours</p>
          <h1 className="brush truncate text-4xl leading-none">La route de {prenom}</h1>
        </div>
        <PictoMasque cle="trek" taille={40} className="shrink-0 text-accent" />
      </header>

      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          { n: bilan.points, label: 'points', picto: 'etincelle' },
          { n: bilan.badges, label: bilan.badges > 1 ? 'badges' : 'badge', picto: 'coupe' },
          { n: bilan.activites, label: bilan.activites > 1 ? 'activités' : 'activité', picto: 'feu_de_camp' },
        ].map((b) => (
          <div key={b.label} className="rounded-xl border border-trait bg-carte px-2 py-2">
            <dt className="sr-only">{b.label}</dt>
            <dd className="flex items-center justify-center gap-1.5">
              <PictoMasque cle={b.picto} taille={16} className="text-accent" />
              <span className="brush text-2xl leading-none tabular-nums">{b.n}</span>
            </dd>
            <p className="panneau text-[9px] text-encre-douce">{b.label}</p>
          </div>
        ))}
      </dl>

      <RouteParcours etapes={vues} depart={etapeDeDepart(etapes)} />
    </div>
  )
}
