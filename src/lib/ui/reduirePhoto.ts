/**
 * Réduit les photos dans le navigateur avant l'envoi. Sur Amplify, le site
 * tourne sur des fonctions serverless dont les requêtes sont plafonnées
 * (environ 6 Mo) : trois photos de téléphone dépasseraient. Le serveur
 * réencode de toute façon en WebP 1600 px, on n'envoie donc pas plus grand.
 */

const BORD_MAX = 2000
const QUALITE = 0.85
/** En dessous, on garde le fichier tel quel. */
const DEJA_LEGER = 900 * 1024

export async function reduirePhoto(fichier: File): Promise<File> {
  if (fichier.size <= DEJA_LEGER || typeof createImageBitmap === 'undefined') return fichier
  try {
    // imageOrientation applique la rotation EXIF des photos de téléphone.
    const image = await createImageBitmap(fichier, { imageOrientation: 'from-image' })
    const echelle = Math.min(1, BORD_MAX / Math.max(image.width, image.height))
    const largeur = Math.round(image.width * echelle)
    const hauteur = Math.round(image.height * echelle)

    const canvas = document.createElement('canvas')
    canvas.width = largeur
    canvas.height = hauteur
    canvas.getContext('2d')?.drawImage(image, 0, 0, largeur, hauteur)
    image.close()

    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', QUALITE))
    if (!blob || blob.size >= fichier.size) return fichier
    return new File([blob], fichier.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    // Format que le navigateur ne sait pas décoder : le serveur tranchera.
    return fichier
  }
}

/** Remplace le contenu d'un champ fichier par les versions réduites. */
export async function reduireChampPhotos(champ: HTMLInputElement): Promise<File[]> {
  const reduites = await Promise.all(Array.from(champ.files ?? []).map(reduirePhoto))
  const transfert = new DataTransfer()
  reduites.forEach((f) => transfert.items.add(f))
  champ.files = transfert.files
  return reduites
}
