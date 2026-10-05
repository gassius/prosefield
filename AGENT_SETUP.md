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
- Prefer the repo scripts: `scripts/check.sh`, `scripts/start.sh`, `scripts/stop.sh`.
- Follow **diagnose → self-recover → escalate** below. Do not treat the first `check.sh` FAIL as the final answer — investigate and fix anything you are allowed to fix, then re-run the check.

### Allowed without asking (user-level and repo-local)

- Loading an existing nvm (`source nvm.sh`), `nvm use`, or `nvm install <version from .nvmrc>` when nvm is already installed
- Enabling Corepack / pnpm **inside the nvm Node prefix** (writable user prefix)
- `pnpm install` / `pnpm install --frozen-lockfile` in this repo
- Running repo scripts (`scripts/check.sh`, `scripts/start.sh`, `scripts/stop.sh`, and other `scripts/*` for this project)
- `docker compose` for **this** repo’s services
- Re-running checks with the right access (for example asking your own harness for permission to reach the Docker socket)
- Restarting or stopping **Prosefield’s own** containers or processes (`scripts/stop.sh`, compose down **without** `-v`)

### Stop and ask the human only when

- A prerequisite is genuinely missing: no Docker CLI at all, no nvm **and** no Node, no Git, no WSL2 on Windows
- The fix needs a **system-wide** install or change: apt/brew/choco, global npm, installing Docker or nvm itself, `sudo`, docker group membership, or daemon config
- A required port is owned by a **non-Prosefield** process
- The fix would delete data (`docker compose down -v`) or stop an unrelated service

### When escalating

Show the exact evidence (the failing `FAIL` line, relevant command output, owning process) and ask for **exactly one** specific action. Do not dump a laundry list of possible installs.

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

3. **Diagnose → self-recover → escalate** for any FAIL (do **not** STOP at the first FAIL without investigating):

   Use the playbooks below. After each self-fix, re-run `bash scripts/check.sh`. Proceed to step 4 only when the check exits 0, or escalate with evidence when the fix needs the human.

   #### Playbook: Node version mismatch / missing

   1. Read `.nvmrc`. If `node -v` already matches, you are done.
   2. If nvm exists but is not loaded (`~/.nvm/nvm.sh` or `$NVM_DIR/nvm.sh`), **load it** and run `nvm use` (or `nvm install` for the `.nvmrc` version). `scripts/check.sh` and `scripts/start.sh` also load nvm the same way — prefer a fresh shell after install, or just re-run the scripts.
   3. If nvm is present and the hint says so: run `nvm install` in the repo (reads `.nvmrc`). That is allowed without asking.
   4. Escalate only when there is **no nvm and no matching Node**: ask the human to install nvm (user-level), with the nvm link below. Do not run apt/brew/choco yourself.

   #### Playbook: Docker unreachable

   Read the FAIL label and hint — `check.sh` classifies three cases:

   1. **Docker CLI missing** → escalate: ask the human to install Docker Desktop (WSL2 backend) or Docker Engine in WSL2. One ask, with the FAIL line as evidence.
   2. **Docker daemon not running** → ask the human to **start** Docker Desktop / the engine (not reinstall). One ask.
   3. **Docker socket (permission / unreachable)** → self-recover first: re-run the check with socket access (ask your harness for Docker/socket permission). Do **not** tell the human to “install Docker”. Escalate only if you cannot get socket access; then ask for docker group membership or equivalent (needs human / sudo).

   #### Playbook: Occupied ports

   1. If `check.sh` / `start.sh` reports the port **in use by Prosefield**, that is OK — continue (start is idempotent).
   2. If a previous Prosefield start is stuck: run `bash scripts/stop.sh`, then re-check. Do not use `down -v`.
   3. If the FAIL names a **non-Prosefield** owning process: escalate with that process line and ask the human to free the port. Do not kill unrelated services.

4. **Start** (idempotent; safe to re-run):

   ```bash
   bash scripts/start.sh
   ```

   This loads nvm when needed, enables pnpm via Corepack when the Node prefix is writable (nvm), runs `pnpm install --frozen-lockfile`, brings up the Docker backend, and starts the Next.js app on the host at http://localhost:3000.

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

## Official install links (for the human only — use when escalating)

- WSL2 (Windows): https://learn.microsoft.com/en-us/windows/wsl/install
- nvm: https://github.com/nvm-sh/nvm#installing-and-updating
- Docker Desktop: https://docs.docker.com/get-docker/
- Docker Engine (e.g. inside WSL2): https://docs.docker.com/engine/install/
- Git: https://git-scm.com/downloads
