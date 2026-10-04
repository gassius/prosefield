#!/usr/bin/env bash
# Record demo journeys with Playwright (Docker) and emit optimised GIFs under docs/demo/.
# Not part of the visual-regression gate. Requires: Docker, running app + emulators, ffmpeg.
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
  # Small, fast-loading GIFs for README (540px wide, 8 fps).
  ffmpeg -y -i "$trimmed" -vf "fps=8,scale=540:-1:flags=lanczos,palettegen=stats_mode=diff" -update 1 "$palette" </dev/null
  ffmpeg -y -i "$trimmed" -i "$palette" -lavfi "fps=8,scale=540:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5" -loop 0 "$dest" </dev/null
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
