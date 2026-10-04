# Agent setup prompt — Prosefield

Copy everything below the line into your coding agent. Or open this file from the raw GitHub URL and follow it end to end.

---

You are setting up **Prosefield** so a human can try it locally.

## Goal

Clone the repo, verify the machine, start the stack, confirm the landing page returns HTTP 200, then report the app URL and how to sign up (Stripe is mocked in automated flows).

## Constraints

- Work inside **macOS, Linux, or Windows WSL2 (Ubuntu)**. On Windows use WSL2 only — not PowerShell or Git Bash.
- On WSL2: clone into the **Linux filesystem** (for example `~/prosefield`), **not** `/mnt/c/…` (slow bind mounts and broken file watching). Docker Desktop’s WSL2 backend **or** Docker Engine installed inside WSL2 both work.
- Emulators run **only in Docker**. Do not install the Firebase CLI or a host Emulator Suite runtime.
- **Never install anything system-wide** (apt/brew/choco packages, global npm tools, Docker itself, nvm, etc.) without stopping and asking the human first.
- Prefer the repo scripts: `scripts/check.sh`, `scripts/start.sh`, `scripts/stop.sh`.

## Steps

1. **Clone** (skip if already in the repo root). On WSL2 use a path under `~/`:

   ```bash
   git clone https://github.com/gassius/prosefield.git ~/prosefield
   cd ~/prosefield
   ```

2. **Check** requirements (prints PASS/FAIL; exits non-zero on failure):

   ```bash
   bash scripts/check.sh
   ```

3. If anything **FAIL**s: **STOP**. Show the human each failed line and its install link. Ask them to install or fix those items. Do **not** run system package managers or installers yourself unless they explicitly approve a specific install.

4. **Start** (idempotent; safe to re-run):

   ```bash
   bash scripts/start.sh
   ```

   This enables pnpm via Corepack when the Node prefix is writable (nvm), runs `pnpm install --frozen-lockfile`, brings up the Docker backend, and starts the Next.js app on the host at http://localhost:3000.

5. **Verify** the landing page:

   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
   ```

   Expect `200`.

6. **Report** to the human:
   - App URL: http://localhost:3000
   - Sign up: http://localhost:3000/register (then you can try the editor before paying)
   - With default `.env` placeholders, `/subscribe` shows **Billing is not configured** (no real Stripe keys). Demos/tests **mock** payment by seeding emulator entitlement. For a real test-card flow (`4242…`), see README → Manual Stripe test payment (4242). Never commit real keys.
   - Stop: `bash scripts/stop.sh`

## Official install links (for the human only)

- WSL2 (Windows): https://learn.microsoft.com/en-us/windows/wsl/install
- nvm: https://github.com/nvm-sh/nvm#installing-and-updating
- Docker Desktop: https://docs.docker.com/get-docker/
- Docker Engine (e.g. inside WSL2): https://docs.docker.com/engine/install/
- Git: https://git-scm.com/downloads
