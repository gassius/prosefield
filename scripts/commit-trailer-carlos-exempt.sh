#!/usr/bin/env bash
# Exit 0 when a commit is a Carlos manual push that skips Agent trailers.
# Usage: COMMIT_MESSAGE=… scripts/commit-trailer-carlos-exempt.sh <author_login> <author_email> [sha]
# Prints a GitHub Actions ::notice:: naming the sha when exempt.
set -euo pipefail

author_login="${1:-}"
author_email="${2:-}"
sha="${3:-}"

if printf '%s\n' "${COMMIT_MESSAGE:-}" | grep -Eq '^Agent(-[A-Za-z]+)?:'; then
  exit 1
fi

if [ "$author_login" = "gassius" ] && [ "$author_email" = "cgonzalezr@gmail.com" ]; then
  if [ -n "$sha" ]; then
    echo "::notice::Skipping trailer check for ${sha} (Carlos manual commit: author gassius <cgonzalezr@gmail.com>)"
  fi
  exit 0
fi

exit 1
