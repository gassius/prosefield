#!/usr/bin/env bash
# One-command local start: check → Node/.nvmrc → pnpm → backend → host frontend.
# Idempotent. Never installs system-wide packages. Emulators stay in Docker only.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PID_FILE="${PROSEFIELD_DEV_PID_FILE:-$ROOT/.prosefield-dev.pid}"
LOG_FILE="${PROSEFIELD_DEV_LOG_FILE:-$ROOT/.prosefield-dev.log}"
APP_URL="${APP_URL:-http://localhost:3000}"

# Prefer nvm Node from .nvmrc when the active Node does not already match.
# Do not call `nvm use` when Node already matches (CI setup-node / system Node) —
# runners often have nvm.sh present without the .nvmrc version installed in nvm.
required_node="$(tr -d '[:space:]' <"$ROOT/.nvmrc")"
required_node="${required_node#v}"
actual_node=""
if command -v node >/dev/null 2>&1; then
  actual_node="$(node -v 2>/dev/null | tr -d 'v[:space:]')"
fi
if [[ -z "${PROSEFIELD_SKIP_NVM:-}" && "$actual_node" != "$required_node" ]]; then
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

# Enable pnpm via Corepack only when we can write shims next to Node (nvm-local).
# Never run `corepack enable` against an unwritable system Node prefix.
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    node_bin="$(command -v node)"
    node_dir="$(dirname "$node_bin")"
    if [[ -w "$node_dir" ]]; then
      corepack enable >/dev/null
      corepack prepare pnpm@10.32.1 --activate >/dev/null
    else
      echo "pnpm is missing and Corepack cannot write shims in ${node_dir} (not writable)." >&2
      echo "Install Node via nvm, then retry — or install pnpm yourself without system-wide changes." >&2
      exit 1
    fi
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

# True when pid file points at a live process that looks like our session leader.
dev_pid_running() {
  [[ -f "$PID_FILE" ]] || return 1
  local pid
  pid="$(tr -d '[:space:]' <"$PID_FILE")"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  local args
  args="$(ps -o args= -p "$pid" 2>/dev/null || true)"
  printf '%s' "$args" | grep -Eqi '(pnpm|next)'
}

if frontend_healthy; then
  echo "Frontend already responding at ${APP_URL}"
elif dev_pid_running; then
  echo "Waiting for existing frontend (pid $(tr -d '[:space:]' <"$PID_FILE"))…"
  bash "$ROOT/scripts/wait-for-url.sh" "$APP_URL" 90
else
  # Own process group so stop.sh can TERM/KILL the whole tree (pnpm + next).
  # setsid makes $! the session/process-group leader.
  setsid nohup pnpm dev --hostname 127.0.0.1 --port 3000 >"$LOG_FILE" 2>&1 </dev/null &
  echo $! >"$PID_FILE"
  bash "$ROOT/scripts/wait-for-url.sh" "$APP_URL" 90
fi

cat <<EOF

Prosefield is running.
  App:     ${APP_URL}
  Emulator UI: http://127.0.0.1:4000

Stop with:  bash scripts/stop.sh
Logs:       ${LOG_FILE}

Sign up at ${APP_URL}/register. With default .env placeholders, /subscribe shows
"Billing is not configured" (no real Stripe keys). Use Try the editor for a trial
draft, or see README → Manual Stripe test payment (4242). Tests/demos mock pay
via the emulator — never commit real keys.
EOF
