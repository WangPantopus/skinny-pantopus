FROM node:20-alpine AS base
WORKDIR /app

# --- Production dependencies only ---
FROM base AS prod-deps
COPY package.json ./
RUN npm install --omit=dev

# --- All dependencies (includes devDeps like nodemon) ---
FROM base AS all-deps
COPY package.json ./
RUN npm install

# --- Development (hot reload with nodemon) ---
FROM all-deps AS development
COPY . .
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["npx", "nodemon", "app.js"]

# --- Production (minimal, no devDeps) ---
FROM base AS production
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY . .
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["node", "app.js"]
