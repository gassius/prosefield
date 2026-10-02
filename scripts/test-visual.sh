#!/usr/bin/env bash
# Run Playwright visual tests inside the pinned official image so baselines
# match CI. Expects Next.js on APP_URL (default http://localhost:3000) and,
# for logged-in shots, Auth/Firestore emulators on the usual ports.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for visual tests (local + CI)." >&2
  exit 1
fi

PLAYWRIGHT_VERSION="$(
  node -p "require('./node_modules/@playwright/test/package.json').version"
)"
# Tag + digest so local/CI cannot silently float to a different image.
IMAGE="mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-jammy@sha256:167d0506cfbe3c294fb214b2d11737326eeee028aa611fa1ba538e5057675847"
APP_URL="${APP_URL:-http://localhost:3000}"
UPDATE="${UPDATE:-0}"

EXTRA_ARGS=()
if [ "$UPDATE" = "1" ]; then
  EXTRA_ARGS+=(--update-snapshots)
fi

USER_ARGS=()
if [ "$(id -u)" -ne 0 ]; then
  USER_ARGS=(--user "$(id -u):$(id -g)" -e HOME=/tmp)
fi

# Host networking so the container reaches host Next + Docker-published emulators.
docker run --rm --network host \
  "${USER_ARGS[@]}" \
  -v "$ROOT:/work" \
  -w /work \
  -e CI="${CI:-1}" \
  -e PROSEFIELD_VISUAL_DOCKER=1 \
  -e APP_URL="$APP_URL" \
  -e FIREBASE_AUTH_EMULATOR_HOST="${FIREBASE_AUTH_EMULATOR_HOST:-127.0.0.1:9099}" \
  -e FIRESTORE_EMULATOR_HOST="${FIRESTORE_EMULATOR_HOST:-127.0.0.1:8080}" \
  -e FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-demo-prosefield}" \
  "$IMAGE" \
  npx playwright test --project=visual "${EXTRA_ARGS[@]}" "$@"
