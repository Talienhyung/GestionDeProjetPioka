#!/bin/sh
set -e

echo "Application des migrations…"
node_modules/.bin/prisma migrate deploy

echo "Amorçage (idempotent)…"
node_modules/.bin/tsx prisma/seed.ts

echo "Démarrage du site sur le port ${PORT:-3000}."
exec node server.js
