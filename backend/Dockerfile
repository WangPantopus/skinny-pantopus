# Build from the repository root so production uses the same lockfile as CI.
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /workspace

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/package.json
RUN --mount=type=cache,id=pantopus-pnpm,target=/pnpm/store \
    pnpm install --filter pantopus-backend --frozen-lockfile --store-dir /pnpm/store
COPY backend ./backend

FROM dependencies AS prod-deps
RUN pnpm --filter pantopus-backend deploy --prod /out

FROM dependencies AS all-deps
RUN pnpm --filter pantopus-backend deploy /out

FROM node:22-alpine AS development
WORKDIR /app
COPY --from=all-deps /out ./
EXPOSE 8000
CMD ["npm", "run", "dev"]

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /out ./
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD node scripts/healthcheck.js
CMD ["node", "app.js"]

FROM production AS worker
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD node scripts/worker-healthcheck.js
CMD ["node", "worker.js"]
