#!/usr/bin/env bash
# =============================================================================
# EastPark — Full environment reset
# Usage: pnpm dev:reset
#
# ⚠️  DESTRUCTIVE — wipes all Docker volumes (database, redis, minio).
#     Use when you need a completely clean slate.
#
# What it does:
#   1. Stop and remove all containers + volumes
#   2. Re-run dev.sh (start services → migrate → seed → dev server)
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo -e ""
echo -e "${BOLD}${RED}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${RED}║   EastPark — Full Environment Reset      ║${RESET}"
echo -e "${BOLD}${RED}║                                          ║${RESET}"
echo -e "${BOLD}${RED}║  ⚠️  All data will be permanently lost.   ║${RESET}"
echo -e "${BOLD}${RED}╚══════════════════════════════════════════╝${RESET}"
echo -e ""

# ── Confirm ────────────────────────────────────────────────────────────────────
read -rp "  This will delete all local data. Continue? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Aborted.${RESET}"
    exit 0
fi

echo ""

# ── Tear down ─────────────────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}▶ Stopping containers and removing volumes${RESET}"
docker-compose down -v --remove-orphans
echo -e "${CYAN}[ok]${RESET}    Containers and volumes removed"

# ── Remove dist and node_modules caches ───────────────────────────────────────
echo -e "\n${BOLD}${CYAN}▶ Clearing build cache${RESET}"
rm -rf "$ROOT_DIR/dist"
echo -e "${CYAN}[ok]${RESET}    dist/ removed"

# ── Hand off to dev.sh ────────────────────────────────────────────────────────
echo -e "\n${BOLD}${CYAN}▶ Starting fresh environment via dev.sh${RESET}"
exec "$SCRIPT_DIR/dev.sh"
