'use client'

import { useActionState, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { deleteBadgeAction, saveBadgeAction } from '@/app/(admin)/badges/actions'
import { ActionButton } from '@/components/ActionButton'
import { Ecusson } from '@/components/Ecusson'
import { CATALOGUE_PICTOS, FAMILLES_PICTOS } from '@/components/sgdf/catalogue'
import { PictoMasque } from '@/components/sgdf/PictoMasque'
import { BADGE_RULE_TYPES, type BadgeRuleType } from '@/lib/domain/badges'
import { COULEURS_CHARTE, NIVEAUX, NOMS_NIVEAUX, niveauRomain, normaliserCouleur } from '@/lib/domain/badgeLook'
import { EMPTY_FORM_STATE } from '@/lib/formState'
import { REGLES } from '@/lib/ui/reglesBadges'
import { reduireChampPhotos } from '@/lib/ui/reduirePhoto'

export interface BadgeEditable {
  id: string
  name: string
  description: string
  ruleType: string
  threshold: number
  points: number
  sortOrder: number
  level: number
  color: string
  pictoKey: string | null
  imageUrl: string | null
  earnedCount: number
}

interface Props {
  badge: BadgeEditable | null
  couleursRecentes: string[]
  ordreSuivant: number
}

const champ = 'rounded-lg border border-trait bg-carte p-3 text-base'
const etiquette = 'panneau text-[11px] text-encre-douce'

export function BadgeForm({ badge, couleursRecentes, ordreSuivant }: Props) {
  const [state, action, pending] = useActionState(saveBadgeAction.bind(null, badge?.id ?? null), EMPTY_FORM_STATE)

  const [nom, setNom] = useState(badge?.name ?? '')
  const [regle, setRegle] = useState<BadgeRuleType>((badge?.ruleType as BadgeRuleType) ?? 'TACHES_VALIDEES')
  const [niveau, setNiveau] = useState(badge?.level ?? 1)
  const [couleur, setCouleur] = useState(badge?.color ?? COULEURS_CHARTE[0])
  const [saisieHex, setSaisieHex] = useState(couleur)
  const [mode, setMode] = useState<'picto' | 'image'>(badge?.imageUrl ? 'image' : 'picto')
  const [picto, setPicto] = useState<string | null>(badge?.pictoKey ?? null)
  const [apercuImage, setApercuImage] = useState<string | null>(badge?.imageUrl ?? null)
  const [reduction, setReduction] = useState(false)

  const [recherche, setRecherche] = useState('')
  const [famille, setFamille] = useState<string | null>(null)
  const filtre = useDeferredValue(recherche)
  const champImage = useRef<HTMLInputElement>(null)

  const pictos = useMemo(() => {
    const q = filtre
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
    return CATALOGUE_PICTOS.filter(
      (p) =>
        (!famille || p.famille === famille) &&
        (!q ||
          p.nom
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .includes(q)),
    )
  }, [filtre, famille])

  // Libère l'aperçu local quand il est remplacé.
  useEffect(() => {
    return () => {
      if (apercuImage?.startsWith('blob:')) URL.revokeObjectURL(apercuImage)
    }
  }, [apercuImage])

  const choisirCouleur = (c: string) => {
    const n = normaliserCouleur(c)
    setSaisieHex(c)
    if (n) setCouleur(n)
  }

  const palette = [...new Set([...couleursRecentes, ...COULEURS_CHARTE])]
  const regleInfo = REGLES[regle]

  return (
    <form action={action} className="flex flex-col gap-6">
      {/* Aperçu, collé en haut pendant qu'on règle le reste. */}
      <div className="sticky top-0 z-10 -mx-4 flex items-center gap-4 border-b border-trait bg-surface/95 px-4 py-3 backdrop-blur">
        <Ecusson
          pictoKey={picto}
          imageUrl={mode === 'image' ? apercuImage : null}
          color={couleur}
          level={niveau}
          taille={76}
        />
        <div className="min-w-0">
          <p className={etiquette}>
            Niveau {niveauRomain(niveau)} · {NOMS_NIVEAUX[niveau]}
          </p>
          <p className="brush truncate text-3xl leading-tight">{nom || 'Nouveau badge'}</p>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className={etiquette}>Nom</span>
          <input name="name" required maxLength={40} value={nom} onChange={(e) => setNom(e.target.value)} className={champ} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiquette}>Description</span>
          <textarea
            name="description"
            rows={2}
            maxLength={200}
            defaultValue={badge?.description ?? ''}
            placeholder="Ce que le jeune a accompli"
            className={champ}
          />
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="panneau-titre text-lg">Comment on le gagne</h2>
        <label className="flex flex-col gap-1">
          <span className={etiquette}>Condition</span>
          <select name="ruleType" value={regle} onChange={(e) => setRegle(e.target.value as BadgeRuleType)} className={champ}>
            {BADGE_RULE_TYPES.map((r) => (
              <option key={r} value={r}>
                {REGLES[r].label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {regleInfo.seuilFixe ? (
            <input type="hidden" name="threshold" value={regleInfo.seuilFixe} />
          ) : (
            <label className="flex flex-col gap-1">
              <span className={etiquette}>{regleInfo.seuil}</span>
              <input
                name="threshold"
                type="number"
                min={1}
                max={1000}
                required
                defaultValue={badge?.threshold ?? 1}
                className={`${champ} tabular-nums`}
              />
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className={etiquette}>Points en bonus</span>
            <input
              name="points"
              type="number"
              min={0}
              max={1000}
              required
              defaultValue={badge?.points ?? 10}
              className={`${champ} tabular-nums`}
            />
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="panneau-titre text-lg">Niveau</h2>
        <input type="hidden" name="level" value={niveau} />
        <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label="Niveau du badge">
          {NIVEAUX.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={niveau === n}
              onClick={() => setNiveau(n)}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 px-0.5 pt-3 pb-2 transition-colors ${
                niveau === n ? 'border-accent bg-accent-doux' : 'border-transparent hover:bg-surface-haute'
              }`}
            >
              <Ecusson pictoKey={picto ?? 'etoile'} imageUrl={null} color={couleur} level={n} taille={40} />
              <span className="panneau mt-1 text-[9px] leading-tight">{NOMS_NIVEAUX[n]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="panneau-titre text-lg">Couleur</h2>
        <input type="hidden" name="color" value={couleur} />
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={couleur}
            onChange={(e) => choisirCouleur(e.target.value)}
            aria-label="Choisir une couleur"
            className="h-12 w-16 cursor-pointer rounded-lg border border-trait bg-carte p-1"
          />
          <input
            value={saisieHex}
            onChange={(e) => choisirCouleur(e.target.value)}
            onBlur={() => setSaisieHex(couleur)}
            aria-label="Code couleur"
            spellCheck={false}
            className={`${champ} w-32 font-mono uppercase`}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {palette.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => choisirCouleur(c)}
              aria-label={`Couleur ${c}`}
              title={couleursRecentes.includes(c) ? `${c} · déjà utilisée` : `${c} · charte SGDF`}
              className={`size-9 rounded-full border-2 shadow-sm transition-transform hover:scale-110 ${
                couleur === c ? 'border-encre ring-2 ring-accent ring-offset-2' : 'border-carte'
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
        {couleursRecentes.length > 0 ? (
          <p className="text-xs text-encre-douce">Les premières pastilles sont les couleurs déjà utilisées.</p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="panneau-titre text-lg">Dessin</h2>
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="pictoKey" value={picto ?? ''} />
        <div className="grid grid-cols-2 rounded-xl bg-surface-haute p-1" role="tablist">
          {(['picto', 'image'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`panneau rounded-lg py-2 text-xs ${mode === m ? 'bg-carte shadow-sm' : 'text-encre-douce'}`}
            >
              {m === 'picto' ? 'Pictogramme SGDF' : 'Image'}
            </button>
          ))}
        </div>

        <div hidden={mode !== 'picto'} className="flex flex-col gap-3">
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={`Chercher parmi ${CATALOGUE_PICTOS.length} pictos…`}
            className={champ}
          />
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [mask-image:linear-gradient(to_right,transparent,#000_1rem,#000_calc(100%-2.5rem),transparent)]">
            {[null, ...FAMILLES_PICTOS].map((f) => (
              <button
                key={f ?? 'tous'}
                type="button"
                onClick={() => setFamille(f)}
                className={`panneau shrink-0 rounded-full border px-3 py-1 text-[10px] ${
                  famille === f ? 'border-encre bg-encre text-carte' : 'border-trait bg-carte'
                }`}
              >
                {f ?? 'Tous'}
              </button>
            ))}
          </div>
          <ul className="grid max-h-80 grid-cols-5 gap-1.5 overflow-y-auto rounded-xl border border-trait bg-carte p-2 sm:grid-cols-7">
            {pictos.map((p) => (
              <li key={p.cle}>
                <button
                  type="button"
                  onClick={() => setPicto(p.cle)}
                  title={p.nom}
                  aria-label={p.nom}
                  aria-pressed={picto === p.cle}
                  className={`grid aspect-square w-full place-items-center rounded-lg transition-colors ${
                    picto === p.cle ? 'text-carte' : 'text-encre hover:bg-surface-haute'
                  }`}
                  style={picto === p.cle ? { background: couleur } : undefined}
                >
                  <PictoMasque cle={p.cle} taille={30} />
                </button>
              </li>
            ))}
            {pictos.length === 0 ? (
              <li className="col-span-full p-3 text-center text-sm text-encre-douce">Aucun picto ne correspond.</li>
            ) : null}
          </ul>
          {picto ? (
            <p className="text-xs text-encre-douce">
              Choisi : {CATALOGUE_PICTOS.find((p) => p.cle === picto)?.nom ?? picto}
            </p>
          ) : null}
        </div>

        <div hidden={mode !== 'image'} className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-trait bg-carte p-4 hover:border-encre-douce">
            <PictoMasque cle="appareil_photo" taille={32} className="text-accent" />
            <span className="text-sm">
              <strong>{apercuImage ? 'Changer l’image' : 'Choisir une image'}</strong>
              <span className="block text-encre-douce">
                JPEG, PNG ou WebP. Recadrée en carré au centre et allégée automatiquement.
              </span>
            </span>
            <input
              ref={champImage}
              type="file"
              name="image"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={async (e) => {
                const input = e.currentTarget
                const fichier = input.files?.[0]
                if (!fichier) return
                setReduction(true)
                const [reduite] = await reduireChampPhotos(input)
                setReduction(false)
                setApercuImage(URL.createObjectURL(reduite ?? fichier))
              }}
            />
          </label>
          {reduction ? <p className="text-xs text-encre-douce">Allègement de l’image…</p> : null}
          {mode === 'image' && !apercuImage ? (
            <p className="text-xs text-encre-douce">Sans image, le pictogramme choisi sera utilisé.</p>
          ) : null}
        </div>
      </section>

      <details className="rounded-xl border border-trait bg-carte px-3 py-2">
        <summary className="panneau cursor-pointer text-xs text-encre-douce">Avancé</summary>
        <label className="mt-3 flex flex-col gap-1 pb-2">
          <span className={etiquette}>Ordre d’affichage (plus petit = plus haut)</span>
          <input
            name="sortOrder"
            type="number"
            min={0}
            max={10000}
            defaultValue={badge?.sortOrder ?? ordreSuivant}
            className={`${champ} tabular-nums`}
          />
        </label>
      </details>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-erreur-doux p-3 text-sm text-erreur">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || reduction}
        className="panneau rounded-lg bg-bouton p-3 text-base text-sur-bouton disabled:opacity-60"
      >
        {pending ? 'Enregistrement…' : badge ? 'Enregistrer le badge' : 'Créer le badge'}
      </button>

      {badge ? (
        <div className="flex flex-col items-center gap-1 border-t border-trait pt-4 text-center">
          <ActionButton
            action={deleteBadgeAction.bind(null, badge.id)}
            confirm={
              badge.earnedCount > 0
                ? `Supprimer « ${badge.name} » ? Il disparaîtra des ${badge.earnedCount} profil(s) qui l’ont gagné. Les points déjà gagnés restent acquis.`
                : `Supprimer « ${badge.name} » ?`
            }
            className="panneau rounded-lg px-4 py-2 text-xs text-erreur hover:bg-erreur-doux"
          >
            Supprimer ce badge
          </ActionButton>
        </div>
      ) : null}
    </form>
  )
}
