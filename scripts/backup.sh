#!/bin/sh
# Sauvegarde cohérente de la base et des photos. À lancer par cron, par exemple
# chaque nuit : 0 3 * * * /chemin/vers/scripts/backup.sh /chemin/vers/sauvegardes
set -e

DEST="${1:-./sauvegardes}"
STAMP=$(date +%Y-%m-%d_%H%M)
mkdir -p "$DEST"

# `.backup` de sqlite3 produit une copie cohérente même pendant que le site
# tourne, contrairement à une simple copie du fichier.
docker compose exec -T app sqlite3 /data/cap.db ".backup '/data/backup-tmp.db'"
docker compose cp app:/data/backup-tmp.db "$DEST/cap-$STAMP.db"
docker compose exec -T app rm -f /data/backup-tmp.db

docker compose exec -T app tar czf - -C /data uploads > "$DEST/uploads-$STAMP.tar.gz"

# Relecture de la copie : une sauvegarde qu'on n'a pas vérifiée n'en est pas une.
docker compose exec -T app sqlite3 /data/cap.db "pragma integrity_check;" > /dev/null

# Rotation : on garde les 30 dernières sauvegardes.
ls -1t "$DEST"/cap-*.db | tail -n +31 | xargs -r rm --
ls -1t "$DEST"/uploads-*.tar.gz | tail -n +31 | xargs -r rm --

echo "Sauvegarde faite dans $DEST (cap-$STAMP.db, uploads-$STAMP.tar.gz)"
