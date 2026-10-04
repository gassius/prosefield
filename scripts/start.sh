#!/usr/bin/env bash
# One-command local start: check → Node/.nvmrc → pnpm → backend → host frontend.
# Idempotent. Never installs system-wide packages. Emulators stay in Docker only.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PID_FILE="${PROSEFIELD_DEV_PID_FILE:-$ROOT/.prosefield-dev.pid}"
LOG_FILE="${PROSEFIELD_DEV_LOG_FILE:-$ROOT/.prosefield-dev.log}"
APP_URL="${APP_URL:-http://localhost:3000}"

# Prefer nvm Node from .nvmrc when nvm is available (does not install Node).
if [[ -z "${PROSEFIELD_SKIP_NVM:-}" ]]; then
  if [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
    # shellcheck disable=SC1091
    . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
    nvm use >/dev/null
  elif [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    # shellcheck disable=SC1091
    . "$HOME/.nvm/nvm.sh"
    nvm use >/dev/null
  fi
fi

export PROSEFIELD_CHECK_FOR_START=1
bash "$ROOT/scripts/check.sh"

# Enable pnpm via Corepack when needed (user-local; not a system package manager install).
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null
    corepack prepare pnpm@10.32.1 --activate >/dev/null
  else
    echo "pnpm is not available and Corepack is missing. Fix with scripts/check.sh." >&2
    exit 1
  fi
fi

if [[ ! -f "$ROOT/.env" ]]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  echo "Created .env from .env.example (local defaults)."
fi

pnpm install --frozen-lockfile

# Backend (Auth + Firestore emulators) via Compose only — never on the host; no host firebase-tools.
bash "$ROOT/scripts/require-docker.sh" up -d --wait

frontend_healthy() {
  curl -fsS "${APP_URL%/}/api/health" >/dev/null 2>&1
}

dev_pid_running() {
  [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

if frontend_healthy; then
  echo "Frontend already responding at ${APP_URL}"
elif dev_pid_running; then
  echo "Waiting for existing frontend (pid $(cat "$PID_FILE"))…"
  bash "$ROOT/scripts/wait-for-url.sh" "$APP_URL" 90
else
  # Host frontend (default path). Compose `app` profile is optional and not used here.
  nohup pnpm dev --hostname 127.0.0.1 --port 3000 >"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
  bash "$ROOT/scripts/wait-for-url.sh" "$APP_URL" 90
fi

cat <<EOF

Prosefield is running.
  App:     ${APP_URL}
  Emulator UI: http://127.0.0.1:4000

Stop with:  bash scripts/stop.sh
Logs:       ${LOG_FILE}

Sign up at ${APP_URL}/register. Stripe Checkout is mocked in automated tests;
for a real test-card payment see README → Manual Stripe test payment (4242).
EOF
