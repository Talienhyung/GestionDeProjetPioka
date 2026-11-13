#!/bin/sh
# Sauvegarde de la base et des photos (hébergement Docker). À lancer par cron,
# par exemple chaque nuit : 0 3 * * * /chemin/vers/scripts/backup.sh /chemin/vers/sauvegardes
# Sur Amplify, ce script ne sert pas : la base est sauvegardée par le
# fournisseur PostgreSQL et les photos par le versionnement du bucket S3.
set -e

DEST="${1:-./sauvegardes}"
STAMP=$(date +%Y-%m-%d_%H%M)
mkdir -p "$DEST"

# pg_dump produit une copie cohérente même pendant que le site tourne.
docker compose exec -T db pg_dump -U cap -d cap --format=custom > "$DEST/cap-$STAMP.dump"

# Relecture de la copie : une sauvegarde qu'on n'a pas vérifiée n'en est pas une.
docker compose exec -T db pg_restore --list < "$DEST/cap-$STAMP.dump" > /dev/null

docker compose exec -T app tar czf - -C /data uploads > "$DEST/uploads-$STAMP.tar.gz"

# Rotation : on garde les 30 dernières sauvegardes.
ls -1t "$DEST"/cap-*.dump | tail -n +31 | xargs -r rm --
ls -1t "$DEST"/uploads-*.tar.gz | tail -n +31 | xargs -r rm --

echo "Sauvegarde faite dans $DEST (cap-$STAMP.dump, uploads-$STAMP.tar.gz)"
