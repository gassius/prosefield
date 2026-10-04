#!/usr/bin/env bash
# Stop host frontend (if started by start.sh) and Docker Compose backend.
# Only signals PIDs verified as this repo's dev server process group.
set -euo pipefail

# Physical path so symlink checkouts match /proc and lsof cwd (macOS /tmp → /private/tmp).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$ROOT"

PID_FILE="${PROSEFIELD_DEV_PID_FILE:-$ROOT/.prosefield-dev.pid}"

# Test seams (never set in production / CI start-stop):
#   PROSEFIELD_STOP_DISABLE_PROC=1  — skip /proc cwd (force lsof / fail-safe path)
#   PROSEFIELD_STOP_DISABLE_LSOF=1  — skip lsof cwd lookup

# True when PID exists but is a zombie (exited; awaiting reaper). Counts as stopped.
is_zombie() {
  local pid="$1"
  local stat=""
  stat="$(ps -o stat= -p "$pid" 2>/dev/null || true)"
  [[ "$stat" == *Z* ]]
}

# Resolve a directory to its physical path for comparison.
resolve_dir() {
  local p="$1"
  [[ -n "$p" ]] || return 0
  if [[ -d "$p" ]]; then
    (cd "$p" && pwd -P) 2>/dev/null || printf '%s' "$p"
  else
    printf '%s' "$p"
  fi
}

# Resolve process cwd: Linux /proc, else macOS/BSD lsof. Never invent a match.
process_cwd() {
  local pid="$1"
  local cwd=""
  if [[ "${PROSEFIELD_STOP_DISABLE_PROC:-}" != "1" && -e "/proc/${pid}/cwd" ]]; then
    cwd="$(readlink -f "/proc/${pid}/cwd" 2>/dev/null || true)"
  elif [[ "${PROSEFIELD_STOP_DISABLE_LSOF:-}" != "1" ]] && command -v lsof >/dev/null 2>&1; then
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n1 || true)"
  fi
  if [[ -n "$cwd" ]]; then
    cwd="$(resolve_dir "$cwd")"
  fi
  printf '%s' "$cwd"
}

# True when we have a cwd lookup tool available (for clearer refuse messages).
cwd_lookup_available() {
  if [[ "${PROSEFIELD_STOP_DISABLE_PROC:-}" != "1" && -e /proc/self/cwd ]]; then
    return 0
  fi
  if [[ "${PROSEFIELD_STOP_DISABLE_LSOF:-}" != "1" ]] && command -v lsof >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

# True when any non-zombie member of the process group is still alive.
group_has_live_members() {
  local pgid="$1"
  local p=""
  while read -r p; do
    p="$(printf '%s' "$p" | tr -d '[:space:]')"
    [[ -n "$p" ]] || continue
    if kill -0 "$p" 2>/dev/null && ! is_zombie "$p"; then
      return 0
    fi
  done < <(ps -o pid= -g "$pgid" 2>/dev/null || true)
  return 1
}

# Return 0 only when PID is alive (non-zombie) and belongs to this repo's frontend.
is_our_dev_server() {
  local pid="$1"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  if is_zombie "$pid"; then
    return 1
  fi

  local args=""
  args="$(ps -o args= -p "$pid" 2>/dev/null || true)"
  args="$(printf '%s' "$args" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  if [[ -z "$args" || "$args" == *"<defunct>"* ]]; then
    return 1
  fi
  # Must look like pnpm/next (not an arbitrary reused PID).
  if ! printf '%s' "$args" | grep -Eqi '(^|[[:space:]])(pnpm|next)([[:space:]]|$)'; then
    if ! printf '%s' "$args" | grep -Eqi 'pnpm|next-server|/next[[:space:]]|next/dist'; then
      return 1
    fi
  fi

  # Require physical cwd == ROOT (Linux /proc or macOS lsof). Never accept bare "dev".
  local cwd=""
  cwd="$(process_cwd "$pid")"
  cwd="${cwd%/}"
  local root_n="${ROOT%/}"
  if [[ -n "$cwd" ]]; then
    if [[ "$cwd" != "$root_n" ]]; then
      return 1
    fi
  else
    # No cwd available — require absolute ROOT in cmdline (not a "dev" substring).
    if ! printf '%s' "$args" | grep -Fq "$ROOT"; then
      return 1
    fi
  fi

  return 0
}

if [[ -f "$PID_FILE" ]]; then
  pid="$(tr -d '[:space:]' <"$PID_FILE")"
  if [[ -z "$pid" ]]; then
    echo "Empty pid file — removing."
    rm -f "$PID_FILE"
  elif ! kill -0 "$pid" 2>/dev/null; then
    echo "Stale pid file (process ${pid} not running) — removing without signal."
    rm -f "$PID_FILE"
  elif ! is_our_dev_server "$pid"; then
    if ! cwd_lookup_available; then
      echo "Pid ${pid}: cannot verify cwd (no /proc cwd, no lsof) and cmdline lacks this repo path — not signalling."
    else
      echo "Pid ${pid} is not this repo's frontend (cmdline/cwd mismatch) — removing stale file, not signalling."
    fi
    rm -f "$PID_FILE"
  else
    pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d '[:space:]' || true)"
    # Signal the group only when the verified PID is the group leader (pgid == pid).
    signal_group=0
    if [[ -n "$pgid" && "$pgid" =~ ^[0-9]+$ && "$pgid" == "$pid" ]]; then
      signal_group=1
    fi
    if [[ "$signal_group" -eq 1 ]]; then
      kill -TERM -- "-${pgid}" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    else
      kill -TERM "$pid" 2>/dev/null || true
    fi
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      if ! kill -0 "$pid" 2>/dev/null || is_zombie "$pid"; then
        break
      fi
      sleep 1
    done
    if kill -0 "$pid" 2>/dev/null && ! is_zombie "$pid"; then
      # Re-verify before KILL — never escalate against an unverified PID.
      if is_our_dev_server "$pid"; then
        if [[ "$signal_group" -eq 1 ]]; then
          kill -KILL -- "-${pgid}" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
        else
          kill -KILL "$pid" 2>/dev/null || true
        fi
      else
        echo "Pid ${pid} no longer looks like our frontend after TERM — not sending KILL."
      fi
    elif [[ "$signal_group" -eq 1 ]] && group_has_live_members "$pgid"; then
      # Leader gone but children survived TERM — escalate KILL to the group.
      kill -KILL -- "-${pgid}" 2>/dev/null || true
    fi
    if kill -0 "$pid" 2>/dev/null && ! is_zombie "$pid"; then
      echo "Warning: frontend pid ${pid} still alive after stop attempt." >&2
    else
      if [[ "$signal_group" -eq 1 ]]; then
        echo "Stopped frontend process group (leader pid ${pid}, pgid ${pgid})."
      else
        echo "Stopped frontend pid ${pid} (not group leader; pgid ${pgid:-unknown})."
      fi
    fi
    rm -f "$PID_FILE"
  fi
else
  echo "No frontend pid file — if pnpm dev is running elsewhere, stop it manually."
fi

if [[ "${PROSEFIELD_STOP_SKIP_COMPOSE:-}" == "1" ]]; then
  echo "Skipped compose down (PROSEFIELD_STOP_SKIP_COMPOSE=1)."
elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  # Compose interpolates profiled service env even on `down`; use .env.example when missing.
  if [[ -f "$ROOT/.env" ]]; then
    docker compose down
  else
    docker compose --env-file "$ROOT/.env.example" down
  fi
  echo "Stopped Docker Compose services."
else
  echo "Docker not available — skipped compose down."
fi
