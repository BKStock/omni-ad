FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/platform-adapters/package.json ./packages/platform-adapters/
COPY packages/queue/package.json ./packages/queue/
COPY packages/auth/package.json ./packages/auth/
COPY packages/ai-engine/package.json ./packages/ai-engine/
COPY packages/ui/package.json ./packages/ui/
COPY tooling/ ./tooling/
RUN pnpm install --frozen-lockfile --prod=false

# Build
FROM deps AS build
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN pnpm --filter @omni-ad/api build

# Production
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 appuser

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/*/node_modules ./packages/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/ ./packages/

USER appuser
EXPOSE 3001
CMD ["node", "apps/api/dist/server.js"]
