# Image du site, pour un hébergement sur ton propre serveur. Les données
# (fichier JSON) et les photos vivent sur le volume /data ; les photos peuvent
# aller dans S3 si S3_BUCKET est défini, et les données dans DynamoDB si
# DYNAMODB_TABLE l'est.
FROM node:22-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATA_FILE="/data/cap.json"
ENV UPLOAD_DIR="/data/uploads"

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./
# node_modules complet : l'amorçage passe par tsx, en plus des dépendances
# tracées par Next.
COPY --from=build /app/node_modules ./node_modules
COPY docker-entrypoint.sh ./

RUN mkdir -p /data/uploads && chmod +x docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
