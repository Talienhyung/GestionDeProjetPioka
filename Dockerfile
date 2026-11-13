# Image du site. La base PostgreSQL tourne à côté (docker-compose.yml) ;
# les photos vivent sur un volume, ou dans S3 si S3_BUCKET est défini.
FROM node:22-slim AS base
# openssl est requis par les moteurs Prisma sur Debian slim.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
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
ENV UPLOAD_DIR="/data/uploads"

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
# node_modules complet : le conteneur a besoin du CLI Prisma (migrations) et
# de tsx (amorçage) en plus des dépendances tracées par Next.
COPY --from=build /app/node_modules ./node_modules
COPY docker-entrypoint.sh ./

RUN mkdir -p /data/uploads && chmod +x docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
