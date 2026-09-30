# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Dependencies (cached layer)
# prisma/ must be copied BEFORE install — the postinstall hook runs `prisma generate`
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
RUN pnpm install --frozen-lockfile

# Build
COPY . .
RUN pnpm build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Production deps only (prisma CLI is a runtime dep — needed by migrate deploy)
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
RUN pnpm install --frozen-lockfile --prod --ignore-scripts \
	&& pnpm exec prisma generate

# Compiled output
COPY --from=builder /app/dist ./dist

# Drop root — must follow the final COPY so ownership applies to every layer
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Run migrations then start server.
# `exec` replaces the shell so Node becomes PID 1 and receives SIGTERM —
# without it the shell swallows the signal and graceful shutdown never runs.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && exec node dist/main"]
