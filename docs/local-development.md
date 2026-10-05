# Local development

Host frontend with Docker-backed Firebase Auth and Firestore emulators. Nothing else is required on the host beyond nvm/Node, pnpm, Docker, and git.

## Prerequisites (details)

If you prefer not to use `scripts/start.sh`, you need:

- **nvm** (recommended) so the shell matches [`.nvmrc`](../.nvmrc)
- **Node** — exact version from [`.nvmrc`](../.nvmrc)
- **pnpm** — enabled by the start script via Corepack when needed
- **Docker + Compose v2** — required for Auth/Firestore. The Emulator Suite runtime and `firebase-tools` stay inside the Compose image — **do not install the Firebase CLI on the host**.

Nothing else is needed on the host. Emulators run only inside Docker (no global `firebase-tools`).

Windows: use **WSL2 only** ([install guide](https://learn.microsoft.com/en-us/windows/wsl/install)). Clone under `~/…`, not `/mnt/c/…`. Docker Desktop’s WSL2 backend or Docker Engine inside WSL2 both work. `scripts/check.sh` refuses native Windows shells (Git Bash/MSYS) and fails if the repo path is on `/mnt/…`.

## Manual start (optional)

1. `nvm install` (reads [`.nvmrc`](../.nvmrc) and switches to that Node)
2. `corepack enable`
3. Optional: `cp .env.example .env` and paste a Stripe **test** key (`sk_test_…` or `rk_test_…`) when you need real Stripe CLI / billing work. A Stripe test account is free. `pnpm dev` also starts with built-in local defaults if `.env` is missing.
4. Frontend on the host (no backend required):

   ```bash
   pnpm install
   pnpm dev
   ```

   Open http://localhost:3000. Pages render with the backend down; features that need Auth/Firestore degrade until the backend is up.

5. Backend via Docker Compose only — copy `.env.example` to `.env` first (Compose reads Stripe placeholders even when the `stripe` profile is off):

   ```bash
   cp -n .env.example .env
   docker compose up -d --wait
   ```

   Emulator UI http://127.0.0.1:4000 · Auth `:9099` · Firestore `:8080`.

   Or use the wrappers (fail fast if Docker isn't running): `pnpm backend:up` / `pnpm backend:down` / `pnpm backend:logs`.

## Emulator data

Auth/Firestore emulator state lives in the Docker named volume `emulator-data`, mounted at **`/data`** in the container. The entrypoint imports/exports **`/data/export`** (a subdirectory of the volume) so export-on-exit can replace that path without hitting EBUSY on the volume mount point. Data survives `docker compose stop` and `docker compose down`. Wipe only with `docker compose down -v`. The service has `stop_grace_period: 60s` so export can finish.

## Optional Compose profiles

| Profile | Command | Purpose |
|---|---|---|
| (default) | `docker compose up -d --wait` | Backend emulators only |
| `app` | `docker compose --profile app up` | Also run Next.js in Docker on `:3000` |
| `stripe` | `docker compose --profile stripe up` | Stripe CLI webhook forwarder (needs `app`) |

## Optional `app` profile notes

The Compose `app` service builds from [`docker/app.Dockerfile`](../docker/app.Dockerfile): dependencies are installed at **image build** time (not on every start), the process runs as `APP_UID`/`APP_GID` (default `1000:1000` — set these to your host ids on Linux so bind-mounted `.next` is writable), and a healthcheck probes `/api/health` so `docker compose --profile app up -d --wait` waits for the Next.js server.

`node_modules` uses an **anonymous** volume (seeded from the image). After lockfile changes, refresh modules with:

```bash
docker compose --profile app up --build --renew-anon-volumes
```

Or `docker compose down` then `up --build`. Do not rely on a named `app_node_modules` volume — it silently keeps stale installs.

## Scripts (local)

| Command | Purpose |
|---|---|
| `bash scripts/check.sh` / `pnpm check` | Requirements check (no installs) |
| `bash scripts/start.sh` / `pnpm start:local` | Check + install + backend + host `pnpm dev` |
| `bash scripts/stop.sh` / `pnpm stop:local` | Stop host frontend process group + `docker compose down` |
| `pnpm demo:gifs` | Regenerate README demo GIFs (app + emulators must already be up; Docker + ffmpeg) |
| `pnpm dev` | Next.js frontend on the host |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | Static checks |
| `pnpm backend:up` | `docker compose up -d --wait` (requires Docker) |
| `pnpm backend:down` | `docker compose down` |
| `pnpm backend:logs` | Follow emulator logs |
| `pnpm stripe:setup` | Seed Price + webhook secret into `.env` (loads `.env`; Docker required) |
| `pnpm stripe:seed` | Create test Product + monthly Price; print `STRIPE_PRICE_ID` (loads `.env`) |
