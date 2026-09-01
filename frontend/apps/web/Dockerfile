FROM node:20-alpine AS base
RUN corepack enable pnpm

# --- Prune monorepo for @pantopus/web only ---
FROM base AS pruner
RUN npm install -g turbo@2
WORKDIR /app
COPY . .
RUN turbo prune @pantopus/web --docker

# --- Install dependencies from pruned lockfile ---
FROM base AS deps
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# --- Build the application ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/ ./
COPY --from=pruner /app/out/full/ .

# turbo prune only copies workspace packages; copy loose shared files manually
COPY frontend/tsconfig.base.json ./frontend/tsconfig.base.json

ENV NEXT_TELEMETRY_DISABLED=1

# Public env vars must be available at build time (baked into client bundle)
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

RUN pnpm turbo build --filter=@pantopus/web

# --- Production runner (minimal image) ---
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder /app/frontend/apps/web/public ./frontend/apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/frontend/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/apps/web/.next/static ./frontend/apps/web/.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "frontend/apps/web/server.js"]
