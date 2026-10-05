#!/usr/bin/env bash
# Prosefield requirements check (macOS, Linux, WSL2). Bash only — no installs.
# Exit 0 when every check passes; non-zero when anything is missing.
# Loads existing nvm (like start.sh) so a fresh shell with nvm installed can PASS.
set -euo pipefail

# Test override (unit tests); production always uses the repo containing this script.
if [[ -n "${PROSEFIELD_CHECK_ROOT:-}" ]]; then
  ROOT="$PROSEFIELD_CHECK_ROOT"
else
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

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

# When set (used by start.sh), ports already serving our known health endpoints count as pass.
FOR_START="${PROSEFIELD_CHECK_FOR_START:-0}"

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

# WSL2: repo on /mnt/c (or other Windows drives) is slow and breaks file watching.
if [[ "$ROOT" == /mnt/* ]]; then
  fail "Repo path on /mnt/…" \
    "Clone into the Linux filesystem (e.g. ~/prosefield), not /mnt/c/…. See https://learn.microsoft.com/en-us/windows/wsl/filesystems"
  printf '\n%d passed, %d failed.\n' "$PASS" "$FAIL"
  exit 1
fi

cd "$ROOT"

required_node="$(tr -d '[:space:]' <"$ROOT/.nvmrc")"
required_node="${required_node#v}"

# Prefer nvm Node from .nvmrc when the active Node does not already match (same as start.sh).
# Do not call `nvm use` when Node already matches (CI setup-node / system Node).
load_nvm_if_present() {
  if [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
    # shellcheck disable=SC1091
    . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
    return 0
  fi
  if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    # shellcheck disable=SC1091
    . "$HOME/.nvm/nvm.sh"
    return 0
  fi
  return 1
}

nvm_sh_present() {
  [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]] || [[ -s "$HOME/.nvm/nvm.sh" ]]
}

# --- git ---
if command -v git >/dev/null 2>&1; then
  pass "git ($(git --version | head -n1))"
else
  fail "git" "Install Git: https://git-scm.com/downloads"
fi

# --- Node (exact .nvmrc; try loading existing nvm before FAIL) ---
actual_node=""
if command -v node >/dev/null 2>&1; then
  actual_node="$(node -v 2>/dev/null | tr -d 'v[:space:]')"
fi

if [[ "$actual_node" == "$required_node" ]]; then
  pass "Node.js v${actual_node} (matches .nvmrc)"
elif [[ -z "${PROSEFIELD_SKIP_NVM:-}" ]] && load_nvm_if_present; then
  # nvm is present — try switching to .nvmrc (agent-safe; no system-wide install).
  if nvm use >/dev/null 2>&1; then
    actual_node="$(node -v 2>/dev/null | tr -d 'v[:space:]')"
  else
    actual_node=""
    if command -v node >/dev/null 2>&1; then
      actual_node="$(node -v 2>/dev/null | tr -d 'v[:space:]')"
    fi
  fi
  if [[ "$actual_node" == "$required_node" ]]; then
    pass "Node.js v${actual_node} (matches .nvmrc via nvm)"
  else
    fail "Node.js (need v${required_node}; nvm present)" \
      "nvm is installed — run \`nvm install\` (reads .nvmrc) in this repo, then retry. No system-wide install needed."
  fi
elif nvm_sh_present; then
  # PROSEFIELD_SKIP_NVM set, or load failed oddly — still distinguish "nvm present".
  fail "Node.js (need v${required_node}; nvm present)" \
    "nvm is installed — run \`nvm install\` (reads .nvmrc) in this repo, then retry. No system-wide install needed."
elif [[ -z "$actual_node" ]]; then
  fail "Node.js ${required_node}" \
    "No matching Node and no nvm. Install nvm (user-level), then run nvm install in this repo: https://github.com/nvm-sh/nvm#installing-and-updating"
else
  fail "Node.js v${actual_node} (need v${required_node})" \
    "No matching Node and no nvm. Install nvm (user-level), then run nvm install / nvm use in this repo: https://github.com/nvm-sh/nvm#installing-and-updating"
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

# --- Docker CLI / daemon / permission ---
docker_classify_failure() {
  # Reads stderr+stdout from a failed `docker info` in $1.
  # Prints: permission | daemon
  local err="$1"
  if printf '%s' "$err" | grep -Eiq \
    'permission denied|operation not permitted|access denied|socket.*(unreachable|not accessible)|cannot connect to the docker daemon.*permission'; then
    printf 'permission'
  else
    printf 'daemon'
  fi
}

if ! command -v docker >/dev/null 2>&1; then
  fail "Docker CLI" \
    "Install Docker Desktop (WSL2 backend) or Docker Engine inside WSL2, then start it: https://docs.docker.com/get-docker/"
else
  docker_info_out=""
  docker_info_status=0
  set +e
  docker_info_out="$(docker info 2>&1)"
  docker_info_status=$?
  set -e
  if [[ "$docker_info_status" -eq 0 ]]; then
    pass "Docker (daemon running)"
  else
    case "$(docker_classify_failure "$docker_info_out")" in
      permission)
        fail "Docker socket (permission / unreachable)" \
          "Docker CLI is present but cannot reach the daemon socket (permission or sandbox). Re-run this check with access to the Docker socket — do not install Docker. Hint: ask your agent harness for Docker/socket permission, or add your user to the docker group (needs human)."
        ;;
      *)
        fail "Docker daemon not running" \
          "Start Docker Desktop (WSL2 backend) or the Docker Engine daemon in WSL2: https://docs.docker.com/engine/install/"
        ;;
    esac
  fi
fi

# --- Docker Compose v2 (`docker compose`) ---
if command -v docker >/dev/null 2>&1; then
  docker_ok=0
  set +e
  docker info >/dev/null 2>&1
  docker_ok=$?
  set -e
  if [[ "$docker_ok" -eq 0 ]]; then
    if docker compose version >/dev/null 2>&1; then
      pass "Docker Compose v2 ($(docker compose version --short 2>/dev/null || echo ok))"
    else
      fail "Docker Compose v2" \
        "Install Docker Compose V2 (bundled with Docker Desktop): https://docs.docker.com/compose/install/"
    fi
  else
    fail "Docker Compose v2" \
      "Docker daemon unreachable — fix Docker first (start daemon, or re-run with socket access), then confirm Compose V2: https://docs.docker.com/compose/install/"
  fi
fi

# --- Dev-server process group path (start.sh) ---
if command -v setsid >/dev/null 2>&1; then
  pass "Dev-server process group: setsid"
elif command -v perl >/dev/null 2>&1; then
  pass "Dev-server process group: set -m + perl setpgrp (setsid unavailable — macOS/other)"
else
  pass "Dev-server process group: set -m (setsid/perl unavailable)"
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

port_owner_line() {
  # Best-effort: print "cmd pid" for the LISTEN owner, or empty.
  local port="$1"
  local line=""
  if command -v lsof >/dev/null 2>&1; then
    line="$(lsof -iTCP:"$port" -sTCP:LISTEN -n -P 2>/dev/null | awk 'NR==2 {print $1, $2; exit}')"
  fi
  if [[ -z "$line" ]] && command -v ss >/dev/null 2>&1; then
    # ss -p: users:(("nginx",pid=123,fd=6)) — portable sed, no gawk-only match().
    line="$(ss -ltnp "( sport = :${port} )" 2>/dev/null \
      | sed -n 's/.*users:((\"\([^"]*\)\",pid=\([0-9][0-9]*\).*/\1 \2/p' \
      | head -n1)"
  fi
  printf '%s' "$line"
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
  local owner
  owner="$(port_owner_line "$port")"
  if [[ -n "$owner" ]]; then
    fail "Port ${port}" \
      "Owned by non-Prosefield process: ${owner}. Free port ${port}, or run scripts/stop.sh only if that process is a previous Prosefield start. Do not kill unrelated services."
  else
    fail "Port ${port}" \
      "Free port ${port} (stop the other process), or run scripts/stop.sh if a previous Prosefield start is still running. Do not kill unrelated services."
  fi
}

for p in 3000 4000 8080 9099 9150; do
  check_port "$p"
done

printf '\n%d passed, %d failed.\n' "$PASS" "$FAIL"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0
