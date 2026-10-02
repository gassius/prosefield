# Prosefield

Local-first writing workspace. Specs live in [`docs/architecture.md`](docs/architecture.md) (v1.0) and [`docs/art-direction.md`](docs/art-direction.md) (v1.1).

## Prerequisites

- **nvm** (recommended) — run `nvm use` at the repo root so the shell matches [`.nvmrc`](.nvmrc)
- **Node** — exact version from `.nvmrc` (currently 24.21.0)
- **pnpm** — via Corepack (`corepack enable`)
- **Docker + Compose** — only required to run the backend (Auth, Firestore, Emulator UI)

No host JDK and no global `firebase-tools`. Emulators run only inside Docker.

## Quick start

1. `nvm use`
2. `cp .env.example .env`, then paste a Stripe **test** key (`sk_test_…` only). A Stripe test account is free.
3. Frontend (no backend required):

   ```bash
   pnpm install
   pnpm dev
   ```

   Open http://localhost:3000. Pages render with the backend down; features that need Auth/Firestore degrade until the backend is up.

4. Backend (Docker only):

   ```bash
   docker compose up -d --wait
   ```

   Emulator UI http://127.0.0.1:4000 · Auth `:9099` · Firestore `:8080`.

   Or use the wrappers (fail fast if Docker isn't running): `pnpm backend:up` / `pnpm backend:down` / `pnpm backend:logs`.

### Emulator data

Auth/Firestore emulator state lives in the Docker named volume `emulator-data` (mounted at `/workspace/.emulator-data` in the container). It survives `docker compose stop` and `docker compose down`. Wipe only with `docker compose down -v`. On stop/down the entrypoint uses `--export-on-exit`; the service has `stop_grace_period: 60s` so export can finish.

### Optional Compose profiles

| Profile | Command | Purpose |
|---|---|---|
| (default) | `docker compose up -d --wait` | Backend emulators only |
| `app` | `docker compose --profile app up` | Also run Next.js in Docker on `:3000` |
| `stripe` | `docker compose --profile stripe up` | Stripe CLI webhook forwarder (needs `app`) |

Stripe webhook secret:

```bash
docker compose run --rm stripe-cli listen --print-secret
```

Compose maps `STRIPE_SECRET_KEY` from `.env` to the CLI's `STRIPE_API_KEY`. Put the printed value in `.env` as `STRIPE_WEBHOOK_SECRET`, then start with the `stripe` profile.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Next.js frontend on the host |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | Static checks |
| `pnpm backend:up` | `docker compose up -d --wait` (requires Docker) |
| `pnpm backend:down` | `docker compose down` |
| `pnpm backend:logs` | Follow emulator logs |
