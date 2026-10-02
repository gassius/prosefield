#!/usr/bin/env bash
set -euo pipefail

# Named volume is mounted at /data (parent). Export into a subdirectory so
# firebase-tools can rmSync+rename the export path without hitting EBUSY on
# the volume mount point.
mkdir -p /data

exec firebase emulators:start \
  --project demo-prosefield \
  --only auth,firestore,ui \
  --import /data/export \
  --export-on-exit /data/export
