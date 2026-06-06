FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
RUN npm ci --workspace=apps/api --workspace=packages/shared

FROM deps AS builder
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/api

FROM base AS runner
RUN addgroup -S sbgroup && adduser -S sbuser -G sbgroup
COPY --from=builder --chown=sbuser:sbgroup /app/apps/api/dist ./dist
COPY --from=builder --chown=sbuser:sbgroup /app/apps/api/prisma ./prisma
COPY --from=builder --chown=sbuser:sbgroup /app/node_modules ./node_modules
USER sbuser
EXPOSE 3001
CMD ["node", "dist/main.js"]
