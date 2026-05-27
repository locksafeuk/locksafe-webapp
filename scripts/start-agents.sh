#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# LockSafe Mac Studio Agent Runner — Quick Start
# ─────────────────────────────────────────────────────────────────────────────
# Usage:  ./scripts/start-agents.sh
#
# Checks all prerequisites, creates the logs/ directory if missing,
# then starts or restarts the PM2 process.
# ─────────────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")/.."    # always run from locksafe-webapp root

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

info()    { echo -e "${GREEN}✔${RESET}  $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET}  $*"; }
error()   { echo -e "${RED}✘${RESET}  $*" >&2; }
heading() { echo -e "\n${BOLD}$*${RESET}"; }

# ─── 1. Check prerequisites ──────────────────────────────────────────────────
heading "Checking prerequisites..."

# Node / npm
if ! command -v node &>/dev/null; then
  error "Node.js not found. Install via Homebrew: brew install node"
  exit 1
fi
info "Node.js $(node --version)"

# tsx (TypeScript runner)
if ! npx --yes tsx --version &>/dev/null 2>&1; then
  warn "tsx not found globally — it will be pulled via npx on first run (slow once)."
else
  info "tsx available"
fi

# PM2
if ! command -v pm2 &>/dev/null; then
  warn "PM2 not found — installing globally..."
  npm install -g pm2
  info "PM2 installed: $(pm2 --version)"
else
  info "PM2 $(pm2 --version)"
fi

# Ollama
if ! curl -sf http://localhost:11434/api/tags &>/dev/null; then
  error "Ollama is not running on localhost:11434."
  error "Start it with:  ollama serve"
  exit 1
fi
info "Ollama is running"

# Check a capable model is present
MODELS=$(curl -sf http://localhost:11434/api/tags | grep -o '"name":"[^"]*"' | sed 's/"name":"//;s/"//' | head -5)
echo "   Models available: $(echo "$MODELS" | tr '\n' '  ')"

# .env.agent-runner
if [ ! -f .env.agent-runner ]; then
  error ".env.agent-runner not found."
  error "Copy the example and fill it in:"
  error "  cp .env.agent-runner.example .env.agent-runner"
  error "  nano .env.agent-runner"
  exit 1
fi
info ".env.agent-runner found"

# Quick check for critical vars
for VAR in DATABASE_URL JWT_SECRET TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID; do
  if ! grep -qE "^${VAR}=.+" .env.agent-runner; then
    error "${VAR} is missing or empty in .env.agent-runner"
    exit 1
  fi
done
info "Critical env vars present"

# ─── 2. Create logs directory ────────────────────────────────────────────────
mkdir -p logs
info "logs/ directory ready"

# ─── 3. Start / restart PM2 process ─────────────────────────────────────────
heading "Starting agent runner with PM2..."

if pm2 describe locksafe-agents &>/dev/null; then
  warn "Process 'locksafe-agents' already exists — restarting..."
  pm2 restart locksafe-agents
else
  pm2 start ecosystem.config.js
fi

# ─── 4. Save PM2 process list ────────────────────────────────────────────────
pm2 save
info "PM2 process list saved"

# ─── 5. Summary ──────────────────────────────────────────────────────────────
heading "✅ Agent runner started!"
echo ""
echo "  Live logs:     pm2 logs locksafe-agents"
echo "  Dashboard:     pm2 monit"
echo "  Stop:          pm2 stop locksafe-agents"
echo "  Restart:       pm2 restart locksafe-agents"
echo ""
echo "  The runner ticks every 5 minutes."
echo "  Watch the first heartbeat in Telegram (~10 seconds after start)."
echo ""

pm2 list
