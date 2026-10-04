#!/usr/bin/env bash
# Prosefield requirements check (macOS, Linux, WSL2). Bash only — no installs.
# Exit 0 when every check passes; non-zero when anything is missing.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# When set (used by start.sh), ports already serving our known health endpoints count as pass.
FOR_START="${PROSEFIELD_CHECK_FOR_START:-0}"

PASS=0
FAIL=0

pass() {
  printf 'PASS  %s\n' "$1"
  PASS=$((PASS + 1))
}

fail() {
  # $1 = label, $2 = one-line install hint with official link
  printf 'FAIL  %s\n' "$1"
  printf '      %s\n' "$2"
  FAIL=$((FAIL + 1))
}

# --- Refuse native Windows shells (Git Bash / MSYS); use WSL2 instead. ---
uname_s="$(uname -s 2>/dev/null || true)"
if [[ "${OSTYPE:-}" == msys* || "${OSTYPE:-}" == cygwin* ]] \
  || [[ -n "${MSYSTEM:-}" ]] \
  || [[ "$uname_s" == MINGW* || "$uname_s" == MSYS* ]]; then
  fail "Environment" \
    "Use WSL2 (Ubuntu) with Docker Desktop’s WSL2 backend — not Git Bash. Install: https://learn.microsoft.com/en-us/windows/wsl/install"
  printf '\n%d passed, %d failed.\n' "$PASS" "$FAIL"
  exit 1
fi

required_node="$(tr -d '[:space:]' <"$ROOT/.nvmrc")"
required_node="${required_node#v}"

# --- git ---
if command -v git >/dev/null 2>&1; then
  pass "git ($(git --version | head -n1))"
else
  fail "git" "Install Git: https://git-scm.com/downloads"
fi

# --- Node (exact .nvmrc) ---
if ! command -v node >/dev/null 2>&1; then
  fail "Node.js ${required_node}" \
    "Install nvm, then run nvm install in this repo: https://github.com/nvm-sh/nvm#installing-and-updating"
else
  actual_node="$(node -v 2>/dev/null | tr -d 'v[:space:]')"
  if [[ "$actual_node" == "$required_node" ]]; then
    pass "Node.js v${actual_node} (matches .nvmrc)"
  else
    fail "Node.js v${actual_node} (need v${required_node})" \
      "Install nvm and run nvm install / nvm use in this repo: https://github.com/nvm-sh/nvm#installing-and-updating"
  fi
fi

# --- pnpm via existing binary or Corepack (scripts enable it; we never install system-wide) ---
if command -v pnpm >/dev/null 2>&1; then
  pass "pnpm ($(pnpm --version 2>/dev/null || echo present))"
elif command -v corepack >/dev/null 2>&1; then
  pass "pnpm (via Corepack — start script will enable it)"
else
  fail "pnpm" \
    "Install Node via nvm (includes Corepack), then retry: https://github.com/nvm-sh/nvm#installing-and-updating"
fi

# --- Docker daemon ---
if ! command -v docker >/dev/null 2>&1; then
  fail "Docker" \
    "Install Docker Desktop (or Docker Engine) and start it: https://docs.docker.com/get-docker/"
else
  if docker info >/dev/null 2>&1; then
    pass "Docker (daemon running)"
  else
    fail "Docker daemon" \
      "Start Docker Desktop (or the Docker daemon), then retry: https://docs.docker.com/get-docker/"
  fi
fi

# --- Docker Compose v2 (`docker compose`) ---
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then
    pass "Docker Compose v2 ($(docker compose version --short 2>/dev/null || echo ok))"
  else
    fail "Docker Compose v2" \
      "Install Docker Compose V2 (bundled with Docker Desktop): https://docs.docker.com/compose/install/"
  fi
elif command -v docker >/dev/null 2>&1; then
  fail "Docker Compose v2" \
    "Start Docker first, then confirm Compose V2: https://docs.docker.com/compose/install/"
fi

# --- Free ports (or already our services when FOR_START=1) ---
port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "( sport = :${port} )" 2>/dev/null | grep -q ":${port}"
    return $?
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN -n -P >/dev/null 2>&1
    return $?
  fi
  # Fallback: bash /dev/tcp
  (echo >/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1
}

port_ok_for_start() {
  local port="$1"
  case "$port" in
    3000)
      curl -fsS "http://127.0.0.1:3000/api/health" >/dev/null 2>&1
      ;;
    4000)
      curl -fsS "http://127.0.0.1:4000" >/dev/null 2>&1
      ;;
    8080)
      curl -fsS "http://127.0.0.1:8080" >/dev/null 2>&1
      ;;
    9099)
      curl -fsS "http://127.0.0.1:9099" >/dev/null 2>&1
      ;;
    9150)
      # Emulator hub; presence of listener is enough when FOR_START
      port_in_use 9150
      ;;
    *)
      return 1
      ;;
  esac
}

check_port() {
  local port="$1"
  if ! port_in_use "$port"; then
    pass "Port ${port} free"
    return
  fi
  if [[ "$FOR_START" == "1" ]] && port_ok_for_start "$port"; then
    pass "Port ${port} in use by Prosefield (ok for start)"
    return
  fi
  fail "Port ${port}" \
    "Free port ${port} (stop the other process), or run scripts/stop.sh if a previous Prosefield start is still running."
}

for p in 3000 4000 8080 9099 9150; do
  check_port "$p"
done

printf '\n%d passed, %d failed.\n' "$PASS" "$FAIL"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0
