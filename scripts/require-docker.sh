#!/usr/bin/env bash
# Fail fast when Docker isn't available, then forward to `docker compose`.
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed. Install Docker + Compose, then retry." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop (or the Docker daemon), then retry." >&2
  exit 1
fi

exec docker compose "$@"
