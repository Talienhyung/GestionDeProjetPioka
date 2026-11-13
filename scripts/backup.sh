#!/bin/sh
# Sauvegarde de l'hébergement Docker : données (cap.json) et photos,
# horodatées, en gardant les 30 dernières.
#   sh scripts/backup.sh /chemin/vers/sauvegardes
# Sur Amplify, inutile : DynamoDB garde une restauration à la seconde près
# sur 35 jours (point-in-time recovery) et le bucket S3 est versionné.
set -eu

DEST="${1:?Usage : backup.sh /chemin/vers/sauvegardes}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"
cd "$(dirname "$0")/.."

# Le fichier est remplacé d'un bloc à chaque écriture (écriture puis
# renommage) : une copie est toujours cohérente.
docker compose cp app:/data/cap.json "$DEST/cap-$STAMP.json"
docker compose exec -T app tar -czf - -C /data uploads > "$DEST/photos-$STAMP.tar.gz"

for motif in 'cap-*.json' 'photos-*.tar.gz'; do
  ls -1t "$DEST"/$motif 2>/dev/null | tail -n +31 | xargs -r rm --
done
echo "Sauvegarde terminée : $DEST (cap-$STAMP.json, photos-$STAMP.tar.gz)"
