#!/usr/bin/env bash
# =============================================================================
# EastPark — Development startup script
# Usage: pnpm dev:setup
#
# What it does (in order):
#   1. Verify prerequisites (.env, Docker)
#   2. Start Docker Compose services (postgres, redis, mailpit, minio)
#   3. Wait for postgres and redis to be healthy
#   4. Run Prisma migrations
#   5. Seed the database (idempotent — safe to run on every start)
#   6. Start the NestJS dev server with hot reload
# =============================================================================

set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────
info()    { echo -e "${BLUE}[info]${RESET}  $*"; }
success() { echo -e "${GREEN}[ok]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[warn]${RESET}  $*"; }
error()   { echo -e "${RED}[error]${RESET} $*" >&2; }
step()    { echo -e "\n${BOLD}${CYAN}▶ $*${RESET}"; }
die()     { error "$*"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# ── Banner ────────────────────────────────────────────────────────────────────
echo -e ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${CYAN}║       EastPark — Dev Startup         ║${RESET}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════╝${RESET}"
echo -e ""

# ── Step 1: Check .env ────────────────────────────────────────────────────────
step "Checking environment"

if [ ! -f "$ROOT_DIR/.env" ]; then
    warn ".env not found — creating from .env.example"
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    warn "Please review .env and fill in any missing values before continuing."
    warn "Specifically: AUTH_ACCESS_TOKEN_SECRET and AUTH_REFRESH_TOKEN_SECRET"
    echo ""
    read -rp "  Press Enter to continue with defaults, or Ctrl+C to abort... "
fi

success ".env found"

# ── Step 2: Check Docker ──────────────────────────────────────────────────────
step "Checking Docker"

if ! command -v docker &>/dev/null; then
    die "Docker is not installed or not in PATH. Install Docker Desktop and try again."
fi

if ! docker info &>/dev/null; then
    die "Docker daemon is not running. Start Docker Desktop and try again."
fi

success "Docker is running"

# ── Step 3: Start Docker Compose ──────────────────────────────────────────────
step "Starting local services (postgres, redis, mailpit, minio)"

docker-compose up -d --remove-orphans

success "Containers started"

# ── Step 4: Wait for PostgreSQL ───────────────────────────────────────────────
step "Waiting for PostgreSQL to be ready"

POSTGRES_TIMEOUT=60
POSTGRES_ELAPSED=0

until docker exec eastpark-postgres pg_isready -U postgres -q 2>/dev/null; do
    if [ $POSTGRES_ELAPSED -ge $POSTGRES_TIMEOUT ]; then
        error "PostgreSQL did not become ready within ${POSTGRES_TIMEOUT}s"
        error "Check logs: docker-compose logs postgres"
        exit 1
    fi
    echo -n "."
    sleep 1
    POSTGRES_ELAPSED=$((POSTGRES_ELAPSED + 1))
done

echo ""
success "PostgreSQL is ready (${POSTGRES_ELAPSED}s)"

# ── Step 5: Wait for Redis ────────────────────────────────────────────────────
step "Waiting for Redis to be ready"

REDIS_TIMEOUT=30
REDIS_ELAPSED=0

until docker exec eastpark-redis redis-cli ping 2>/dev/null | grep -q "PONG"; do
    if [ $REDIS_ELAPSED -ge $REDIS_TIMEOUT ]; then
        error "Redis did not become ready within ${REDIS_TIMEOUT}s"
        error "Check logs: docker-compose logs redis"
        exit 1
    fi
    echo -n "."
    sleep 1
    REDIS_ELAPSED=$((REDIS_ELAPSED + 1))
done

echo ""
success "Redis is ready (${REDIS_ELAPSED}s)"

# ── Step 6: Prisma migrate ────────────────────────────────────────────────────
step "Running Prisma migrations"

if pnpm exec prisma migrate dev --skip-generate 2>&1; then
    success "Migrations applied"
else
    die "Migration failed. Check your DATABASE_URL in .env and try again."
fi

# ── Step 7: Seed ──────────────────────────────────────────────────────────────
step "Seeding database (idempotent)"

pnpm seed
success "Seed complete"

# ── Step 8: Start dev server ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  Everything is ready!                  ${RESET}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════${RESET}"
echo -e ""
echo -e "  ${CYAN}API${RESET}         http://localhost:3000/v1"
echo -e "  ${CYAN}Swagger${RESET}     http://localhost:3000/docs"
echo -e "  ${CYAN}WebSocket${RESET}   ws://localhost:3000/orders"
echo -e "  ${CYAN}Mailpit${RESET}     http://localhost:8025"
echo -e "  ${CYAN}MinIO${RESET}       http://localhost:9001  (credentials in .env)"
echo -e "  ${CYAN}Prisma${RESET}      pnpm prisma:studio      → http://localhost:5555"
echo -e ""

step "Starting NestJS dev server (Ctrl+C to stop)"
pnpm dev
