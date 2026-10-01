#!/usr/bin/env bash
set -euo pipefail

mkdir -p /workspace/.emulator-data

exec firebase emulators:start \
  --project demo-prosefield \
  --only auth,firestore,ui \
  --import /workspace/.emulator-data \
  --export-on-exit /workspace/.emulator-data
