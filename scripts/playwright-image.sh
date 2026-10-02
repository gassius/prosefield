#!/usr/bin/env bash
# Single source of truth for the Playwright Docker image (version + digest).
# Sourced by scripts/test-visual.sh; CI must not invent a second reference.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PINNED_PLAYWRIGHT_VERSION="1.63.0"
PINNED_PLAYWRIGHT_DIGEST="sha256:167d0506cfbe3c294fb214b2d11737326eeee028aa611fa1ba538e5057675847"

INSTALLED_PLAYWRIGHT_VERSION="$(
  node -p "require('${ROOT}/node_modules/@playwright/test/package.json').version"
)"

if [ "$INSTALLED_PLAYWRIGHT_VERSION" != "$PINNED_PLAYWRIGHT_VERSION" ]; then
  echo "Playwright package is v${INSTALLED_PLAYWRIGHT_VERSION}; Docker pin expects v${PINNED_PLAYWRIGHT_VERSION}." >&2
  echo "Bump PINNED_PLAYWRIGHT_VERSION + PINNED_PLAYWRIGHT_DIGEST together." >&2
  exit 1
fi

export PLAYWRIGHT_DOCKER_IMAGE="mcr.microsoft.com/playwright:v${PINNED_PLAYWRIGHT_VERSION}-jammy@${PINNED_PLAYWRIGHT_DIGEST}"
