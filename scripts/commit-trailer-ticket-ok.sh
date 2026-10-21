#!/usr/bin/env bash
# Exit 0 when an Agent-Ticket value is allowed.
# Usage: scripts/commit-trailer-ticket-ok.sh <ticket>
# Allowed: none | ClickUp id (lowercase alphanumeric, 9–16 chars) |
#          GitHub issue/PR (#N or owner/repo#N).
set -euo pipefail

ticket="${1:-}"
printf '%s\n' "$ticket" | grep -Eq '^(none|[0-9a-z]{9,16}|#[0-9]+|[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+#[0-9]+)$'
