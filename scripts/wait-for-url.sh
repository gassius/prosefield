#!/usr/bin/env bash
# Wait until a URL responds (Next.js ready).
set -euo pipefail
URL="${1:-${APP_URL:-http://localhost:3000}}"
TRIES="${2:-60}"
HEALTH_URL="$URL"
case "$URL" in
  */api/health) ;;
  */) HEALTH_URL="${URL}api/health" ;;
  *) HEALTH_URL="${URL}/api/health" ;;
esac

for _ in $(seq 1 "$TRIES"); do
  if curl -fsS "$URL" >/dev/null 2>&1 || curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "ready: $URL"
    exit 0
  fi
  sleep 1
done
echo "Timed out waiting for $URL" >&2
exit 1
