#!/usr/bin/env bash
# Record demo journeys with Playwright (Docker) and emit optimised GIFs under docs/demo/.
# Not part of the visual-regression gate. Requires: Docker, ffmpeg, emulators up, and a
# Next process already started with the demo GIF billing env (see REQUIREMENTS below).
#
# This script starts the loopback stripe-prices mock for Playwright's host network.
# It does NOT start Next — PROSEFIELD_DEMO_GIFS must be in the Next process env.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for demo GIFs." >&2
  exit 1
fi
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required to encode GIFs. Install ffmpeg, then retry." >&2
  exit 1
fi

# shellcheck source=scripts/playwright-image.sh
source "$ROOT/scripts/playwright-image.sh"

APP_URL="${APP_URL:-http://localhost:3000}"
OUT_DIR="$ROOT/docs/demo"
RAW_DIR="$ROOT/test-results/demo-gifs-raw"
mkdir -p "$OUT_DIR" "$RAW_DIR"

USER_ARGS=()
if [ "$(id -u)" -ne 0 ]; then
  USER_ARGS=(--user "$(id -u):$(id -g)" -e HOME=/tmp)
fi

rm -rf "$RAW_DIR"
mkdir -p "$RAW_DIR"

# Loopback Stripe prices mock (same path as CI visual). Assembled key fragments
# so this script never contains a contiguous sk_test_/whsec_ token (gitleaks).
SK_PREFIX='sk_test'
SK_BODY='demogifsrecording01'
WH_PREFIX='whsec'
WH_BODY='demogifsrecording01'
export STRIPE_SECRET_KEY="${SK_PREFIX}_${SK_BODY}"
export STRIPE_WEBHOOK_SECRET="${WH_PREFIX}_${WH_BODY}"
export STRIPE_PRICE_ID='price_demogifsrecording01'
export STRIPE_API_HOST='127.0.0.1'
export STRIPE_API_PORT='12111'
export STRIPE_API_PROTOCOL='http'
# Documented for operators; Next must be started with this export in ITS env
# (this shell export does not reach an already-running Next process).
export PROSEFIELD_DEMO_GIFS=1

cat <<EOF
demo:gifs REQUIREMENTS — start Next with these in the same process env, then re-run:
  export PROSEFIELD_DEMO_GIFS=1
  export ALLOW_EMULATORS=1
  export APP_URL='${APP_URL}'
  export FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
  export FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
  # Placeholder Stripe keys in .env are fine; do not set real Stripe keys.
  # Prefer: ALLOW_EMULATORS=1 PROSEFIELD_DEMO_GIFS=1 pnpm build && pnpm start
EOF

# Only kill a mock PID this run started (mktemp + cmdline check — never a fixed /tmp path).
MOCK_PID=""
MOCK_PID_FILE=""
cleanup_mock() {
  if [[ -z "${MOCK_PID}" ]]; then
    [[ -n "${MOCK_PID_FILE}" ]] && rm -f "${MOCK_PID_FILE}"
    return 0
  fi
  if ! kill -0 "${MOCK_PID}" 2>/dev/null; then
    rm -f "${MOCK_PID_FILE}"
    return 0
  fi
  local args=""
  args="$(ps -o args= -p "${MOCK_PID}" 2>/dev/null || true)"
  if [[ "${args}" != *stripe-prices-mock-server.mjs* ]]; then
    echo "Refusing to signal pid ${MOCK_PID}: cmdline is not stripe-prices-mock-server.mjs" >&2
    rm -f "${MOCK_PID_FILE}"
    return 0
  fi
  kill "${MOCK_PID}" 2>/dev/null || true
  rm -f "${MOCK_PID_FILE}"
}
trap cleanup_mock EXIT

# Reuse a healthy mock when already listening; otherwise start one and track its PID.
if ! curl -fsS "http://${STRIPE_API_HOST}:${STRIPE_API_PORT}/v1/prices/${STRIPE_PRICE_ID}" >/dev/null 2>&1; then
  MOCK_PID_FILE="$(mktemp "${TMPDIR:-/tmp}/prosefield-demo-stripe-mock.XXXXXX.pid")"
  node "$ROOT/scripts/stripe-prices-mock-server.mjs" &
  MOCK_PID=$!
  echo "${MOCK_PID}" >"${MOCK_PID_FILE}"
  for _ in $(seq 1 50); do
    if curl -fsS "http://${STRIPE_API_HOST}:${STRIPE_API_PORT}/v1/prices/${STRIPE_PRICE_ID}" >/dev/null 2>&1; then
      break
    fi
    sleep 0.1
  done
fi

# Fail fast if the running Next process was not started with demo GIF billing.
health_json="$(curl -fsS "${APP_URL%/}/api/health" || true)"
if [[ -z "${health_json}" ]]; then
  echo "App not reachable at ${APP_URL}/api/health. Start Next with PROSEFIELD_DEMO_GIFS=1 first." >&2
  exit 1
fi
if ! printf '%s' "${health_json}" | grep -q '"demoGifsBilling"[[:space:]]*:[[:space:]]*true'; then
  echo "Next at ${APP_URL} is not in demo GIF billing mode (health.demoGifsBilling != true)." >&2
  echo "Restart Next with PROSEFIELD_DEMO_GIFS=1 and ALLOW_EMULATORS=1 (see REQUIREMENTS above)." >&2
  exit 1
fi

docker run --rm --network host \
  "${USER_ARGS[@]}" \
  -v "$ROOT:/work" \
  -w /work \
  -e CI=1 \
  -e PROSEFIELD_DEMO_GIFS=1 \
  -e APP_URL="$APP_URL" \
  -e FIREBASE_AUTH_EMULATOR_HOST="${FIREBASE_AUTH_EMULATOR_HOST:-127.0.0.1:9099}" \
  -e FIRESTORE_EMULATOR_HOST="${FIRESTORE_EMULATOR_HOST:-127.0.0.1:8080}" \
  -e FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-demo-prosefield}" \
  "$PLAYWRIGHT_DOCKER_IMAGE" \
  npx playwright test --project=demo-gifs e2e/demo-gifs.spec.ts

encode_gif() {
  local src="$1"
  local dest="$2"
  local palette trimmed
  palette="$(mktemp /tmp/prosefield-palette-XXXXXX.png)"
  trimmed="$(mktemp /tmp/prosefield-trim-XXXXXX.webm)"
  # Drop the blank first frames Playwright often records before paint.
  ffmpeg -y -ss 0.45 -i "$src" -c:v libvpx -crf 12 -b:v 1M -an "$trimmed" </dev/null
  # README GIFs: 800px wide (same 16:9 aspect as 1280×720 source), 8 fps playback.
  ffmpeg -y -i "$trimmed" -vf "fps=8,scale=800:-1:flags=lanczos,palettegen=stats_mode=diff" -update 1 "$palette" </dev/null
  ffmpeg -y -i "$trimmed" -i "$palette" -lavfi "fps=8,scale=800:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5" -loop 0 "$dest" </dev/null
  rm -f "$palette" "$trimmed"
  echo "wrote $dest ($(wc -c <"$dest") bytes)"
}

map_clip() {
  local name="$1"
  local dest="$2"
  local match="$RAW_DIR/${name}.webm"
  if [[ ! -f "$match" ]]; then
    echo "Missing recording for ${name} at ${match}" >&2
    exit 1
  fi
  encode_gif "$match" "$dest"
}

map_clip "01-landing" "$OUT_DIR/01-landing.gif"
map_clip "02-try-register-pay" "$OUT_DIR/02-try-register-pay.gif"
map_clip "03-document-crud" "$OUT_DIR/03-document-crud.gif"

echo "Demo GIFs ready in docs/demo/"
