# =====================================================
# Sayman API — production image
# Build context: monorepo root (Coolify: build context = /)
# =====================================================

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
WORKDIR /app

# ---- 1) deps (layer cache için izole) ----
FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --filter @sayman/api... --filter @sayman/db --filter @sayman/shared

# ---- 2) runtime ----
FROM base AS runtime
RUN apk add --no-cache curl
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

EXPOSE 4300

# Healthcheck — migration'ın bitmesini beklemek için start_period uzun
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -fsS http://localhost:4300/v1/health/healthz >/dev/null || exit 1

# Container start: önce pending migration'ları uygula, sonra API başlat.
# Drizzle journal idempotent — zaten uygulanmış migration'lar atlanır.
# Migration fail ederse container crash eder (deploy fail bildirir).
CMD sh -c "pnpm --filter @sayman/db exec tsx src/migrate.ts && pnpm --filter @sayman/api exec tsx src/index.ts"
