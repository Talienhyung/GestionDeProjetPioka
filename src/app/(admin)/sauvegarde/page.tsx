import { PageHeader } from '@/components/PageHeader'
import { PictoMasque } from '@/components/sgdf/PictoMasque'
import { requireSuperAdmin } from '@/lib/auth/guard'
import { allModels } from '@/lib/data/schema'
import { db } from '@/lib/db'
import { nomFichierExport } from '@/lib/domain/exportCsv'
import { delegue } from '@/lib/services/exportService'

/** Les tables qui parlent à un chef, pour le récapitulatif. */
const NOMS: Record<string, string> = {
  User: 'Comptes',
  Project: 'CAP',
  Task: 'Tâches',
  Submission: 'Rendus',
  PointsEntry: 'Lignes de points',
  Badge: 'Badges',
  UserBadge: 'Écussons gagnés',
  Note: 'Billets',
  Event: 'Événements',
  ExtraJob: 'Petits boulots',
}

export default async function SauvegardePage() {
  await requireSuperAdmin()
  const comptes = await Promise.all(
    allModels()
      .filter((m) => NOMS[m.name])
      .map(async (m) => ({ nom: NOMS[m.name], n: await delegue(db, m.delegate).count() })),
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        picto="carnet"
        surtitre="Administration"
        titre="Sauvegarde"
        retour={{ href: '/profil', label: 'Profil' }}
        description="Télécharge toutes les données du site dans un fichier CSV, à garder en lieu sûr."
      />

      <section className="flex flex-col gap-4 rounded-2xl border border-trait bg-carte p-4">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {comptes.map((c) => (
            <li key={c.nom} className="flex justify-between border-b border-dashed border-trait py-1">
              <span className="text-encre-douce">{c.nom}</span>
              <span className="font-bold tabular-nums">{c.n}</span>
            </li>
          ))}
        </ul>

        <a
          href="/api/export"
          download
          className="panneau flex items-center justify-center gap-2 rounded-lg bg-bouton p-3 text-base text-sur-bouton"
        >
          <PictoMasque cle="carnet_de_bord" taille={20} />
          Télécharger le CSV
        </a>
        <p className="text-center text-xs text-encre-douce">
          Nom du fichier : <span className="font-mono">{nomFichierExport(new Date())}</span>
        </p>
      </section>

      <section className="flex flex-col gap-2 text-sm text-encre-douce">
        <p>
          Une section par table, avec toutes ses colonnes. Le fichier s’ouvre dans Excel ou LibreOffice
          (séparateur point-virgule).
        </p>
        <p>
          <strong className="text-encre">Ce qui n’y est pas :</strong> les mots de passe (même chiffrés), les
          sessions de connexion et les photos elles-mêmes (seulement leurs noms de fichier).
        </p>
      </section>
    </div>
  )
}
