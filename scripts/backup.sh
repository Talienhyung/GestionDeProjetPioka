#!/bin/sh
# Sauvegarde cohérente de la base et des photos. À lancer par cron, par exemple
# chaque nuit : 0 3 * * * /chemin/vers/scripts/backup.sh /chemin/vers/sauvegardes
set -e

DEST="${1:-./sauvegardes}"
STAMP=$(date +%Y-%m-%d_%H%M)
mkdir -p "$DEST"

# VACUUM INTO produit une copie cohérente même pendant que le site tourne,
# contrairement à une simple copie du fichier.
docker compose exec -T app node_modules/.bin/prisma db execute --stdin <<SQL
VACUUM INTO '/data/backup-tmp.db';
SQL

docker compose cp app:/data/backup-tmp.db "$DEST/cap-$STAMP.db"
docker compose exec -T app rm -f /data/backup-tmp.db
docker compose exec -T app tar czf - -C /data uploads > "$DEST/uploads-$STAMP.tar.gz"

# Rotation : on garde les 30 dernières sauvegardes.
ls -1t "$DEST"/cap-*.db | tail -n +31 | xargs -r rm --
ls -1t "$DEST"/uploads-*.tar.gz | tail -n +31 | xargs -r rm --

echo "Sauvegarde faite dans $DEST (cap-$STAMP.db)"
