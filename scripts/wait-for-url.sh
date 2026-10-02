#!/usr/bin/env bash
# Wait until APP_URL responds (Next.js ready).
set -euo pipefail
URL="${1:-${APP_URL:-http://localhost:3000}}"
TRIES="${2:-60}"
for i in $(seq 1 "$TRIES"); do
  if curl -fsS "$URL" >/dev/null 2>&1 || curl -fsS "$URL/api/health" >/dev/null 2>&1; then
    echo "ready: $URL"
    exit 0
  fi
  sleep 1
done
echo "Timed out waiting for $URL" >&2
exit 1
