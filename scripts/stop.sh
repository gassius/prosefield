#!/usr/bin/env bash
# Stop host frontend (if started by start.sh) and Docker Compose backend.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PID_FILE="${PROSEFIELD_DEV_PID_FILE:-$ROOT/.prosefield-dev.pid}"

if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE")"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    # Give Next a moment; escalate if needed.
    for _ in 1 2 3 4 5; do
      kill -0 "$pid" 2>/dev/null || break
      sleep 1
    done
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
    echo "Stopped frontend (pid ${pid})."
  else
    echo "Stale pid file (process ${pid} not running)."
  fi
  rm -f "$PID_FILE"
else
  echo "No frontend pid file — if pnpm dev is running elsewhere, stop it manually."
fi

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  # Compose interpolates profiled service env even on `down`; use .env.example when missing.
  if [[ -f "$ROOT/.env" ]]; then
    docker compose down
  else
    docker compose --env-file "$ROOT/.env.example" down
  fi
  echo "Stopped Docker Compose services."
else
  echo "Docker not available — skipped compose down."
fi

