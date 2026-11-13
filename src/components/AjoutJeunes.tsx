'use client'

import { useActionState, useEffect, useRef } from 'react'
import { type LotState, createJeunesAction } from '@/app/(admin)/comptes/actions'

function telecharger(base64: string) {
  const octets = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([octets], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `codes-connexion-${new Date().toISOString().slice(0, 10)}.pdf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Plusieurs jeunes d'un coup : un nom par ligne. Les identifiants sont
 * proposés d'après les noms ; le PDF des bandes à découper (identifiant, mot de
 * passe provisoire, QR code) se télécharge aussitôt.
 */
export function AjoutJeunes({ groupes }: { groupes: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<LotState, FormData>(createJeunesAction, {})
  const form = useRef<HTMLFormElement>(null)
  const dejaTelecharge = useRef<string | null>(null)

  useEffect(() => {
    if (state.pdf && dejaTelecharge.current !== state.pdf) {
      dejaTelecharge.current = state.pdf
      telecharger(state.pdf)
      form.current?.reset()
    }
  }, [state.pdf])

  return (
    <div className="flex flex-col gap-3">
      <form ref={form} action={action} className="flex flex-col gap-3 rounded-xl border border-trait bg-carte p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Un jeune par ligne, prénom et nom</span>
          <textarea
            name="noms"
            required
            rows={6}
            placeholder={'Lucie Martin\nTom Bernard\nInès Moreau'}
            className="rounded-lg border border-trait bg-surface p-3 text-base"
          />
        </label>
        {groupes.length > 0 ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Dans le groupe</span>
            <select name="groupeId" defaultValue="" className="rounded-lg border border-trait bg-surface p-3 text-base">
              <option value="">Aucun pour l&apos;instant</option>
              {groupes.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <p className="text-xs text-encre-douce">
          Les identifiants sont faits d&apos;après les prénoms (lucie, tom.b…). Tu reçois un PDF avec une bande à
          découper par jeune : identifiant, mot de passe provisoire et un QR code qui ouvre le site.
        </p>
        {state.error ? (
          <p role="alert" className="rounded-lg bg-erreur-doux p-3 text-sm text-erreur">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="panneau rounded-lg bg-bouton p-3 text-base text-sur-bouton disabled:opacity-60"
        >
          {pending ? 'Création…' : 'Créer les comptes et le PDF'}
        </button>
      </form>

      {state.crees && state.pdf ? (
        <div className="rounded-xl border-2 border-ok bg-ok-doux p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold text-ok">
              {state.crees.length} compte{state.crees.length > 1 ? 's' : ''} créé{state.crees.length > 1 ? 's' : ''}.
            </p>
            <button
              type="button"
              onClick={() => telecharger(state.pdf as string)}
              className="panneau rounded-lg bg-bouton px-3 py-2 text-xs text-sur-bouton"
            >
              Retélécharger le PDF
            </button>
          </div>
          <p className="mt-1 text-encre-douce">
            Garde le PDF : les mots de passe provisoires ne seront plus jamais affichés après avoir quitté cette page.
          </p>
          <table className="mt-3 w-full text-left text-xs">
            <thead className="panneau text-[10px] text-encre-douce">
              <tr>
                <th className="py-1">Nom</th>
                <th>Identifiant</th>
                <th>Mot de passe</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {state.crees.map((c) => (
                <tr key={c.username} className="border-t border-trait">
                  <td className="py-1 font-sans">{c.displayName}</td>
                  <td>{c.username}</td>
                  <td>{c.tempPassword}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
