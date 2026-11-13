#!/bin/sh
set -e

echo "Amorçage (idempotent)…"
node node_modules/tsx/dist/cli.mjs prisma/seed.ts

echo "Démarrage du site sur le port ${PORT:-3000}."
exec node server.js
