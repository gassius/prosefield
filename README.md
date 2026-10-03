# Prosefield

Local-first writing workspace. Specs live in [`docs/architecture.md`](docs/architecture.md) (v1.0) and [`docs/art-direction.md`](docs/art-direction.md) (v1.1).

## Prerequisites

- **nvm** (recommended) — run `nvm use` at the repo root so the shell matches [`.nvmrc`](.nvmrc)
- **Node** — exact version from [`.nvmrc`](.nvmrc) (`nvm use`)
- **pnpm** — via Corepack (`corepack enable`)
- **Docker + Compose** — only required to run the backend (Auth, Firestore, Emulator UI)

Nothing else is needed on the host. Emulators run only inside Docker (no global `firebase-tools`).

## Quick start

1. `nvm use`
2. Optional: `cp .env.example .env` and paste a Stripe **test** key (`sk_test_…` or `rk_test_…`) when you need real Stripe CLI / billing work. A Stripe test account is free. `pnpm dev` also starts with built-in local defaults if `.env` is missing.
3. Frontend (no backend required):

   ```bash
   pnpm install
   pnpm dev
   ```

   Open http://localhost:3000. Pages render with the backend down; features that need Auth/Firestore degrade until the backend is up.

4. Backend (Docker only) — copy `.env.example` to `.env` first (Compose reads Stripe placeholders even when the `stripe` profile is off):

   ```bash
   cp -n .env.example .env
   docker compose up -d --wait
   ```

   Emulator UI http://127.0.0.1:4000 · Auth `:9099` · Firestore `:8080`.

   Or use the wrappers (fail fast if Docker isn't running): `pnpm backend:up` / `pnpm backend:down` / `pnpm backend:logs`.

### Emulator data

Auth/Firestore emulator state lives in the Docker named volume `emulator-data`, mounted at **`/data`** in the container. The entrypoint imports/exports **`/data/export`** (a subdirectory of the volume) so export-on-exit can replace that path without hitting EBUSY on the volume mount point. Data survives `docker compose stop` and `docker compose down`. Wipe only with `docker compose down -v`. The service has `stop_grace_period: 60s` so export can finish.

### Optional Compose profiles

| Profile | Command | Purpose |
|---|---|---|
| (default) | `docker compose up -d --wait` | Backend emulators only |
| `app` | `docker compose --profile app up` | Also run Next.js in Docker on `:3000` |
| `stripe` | `docker compose --profile stripe up` | Stripe CLI webhook forwarder (needs `app`) |

### Manual Stripe test payment (4242)

CI never needs real Stripe credentials or network. For a local end-to-end payment with Carlos's **test-mode** keys:

1. Put your `sk_test_…` or `rk_test_…` in `.env` as `STRIPE_SECRET_KEY` (never commit `.env`).
2. Run `pnpm stripe:setup` — seeds a Price, writes `STRIPE_PRICE_ID` into `.env`, runs `docker compose run --rm stripe-cli listen --print-secret`, and writes `STRIPE_WEBHOOK_SECRET` into `.env` (updates in place; never prints secret values). Requires Docker.
3. Start the app on the host (`pnpm dev`) and emulators (`pnpm backend:up`).
4. Forward webhooks with the Stripe CLI (needs the `app` profile, or point `--forward-to` at `host.docker.internal:3000` if the CLI reaches the host):

   ```bash
   docker compose --profile app --profile stripe up
   ```

5. Register, open `/subscribe`, continue to Checkout, pay with `4242 4242 4242 4242` (any future expiry, any CVC). You should land on `/billing/status`, then `/documents` once the verified webhook (or session-sync fallback) projects `status: active`.

`/subscribe` stays **Billing is not configured** until all three of `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET` are set to non-placeholder values. Without them the app still boots: plan display falls back to `PLAN_DISPLAY_*` (€8/month).

Compose maps `STRIPE_SECRET_KEY` from `.env` to the CLI's `STRIPE_API_KEY`. For a webhook secret alone (without re-seeding):

```bash
docker compose run --rm stripe-cli listen --print-secret
```

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Next.js frontend on the host |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | Static checks |
| `pnpm test:component` | React Testing Library component suite (jsdom) |
| `pnpm test:coverage` | Unit + component + integration with V8 coverage thresholds (needs emulators) |
| `pnpm test:integration` | Session/guard tests against running emulators (`pnpm backend:up` first) |
| `pnpm test:e2e` | Playwright Chromium E2E + axe a11y (app + emulators running) |
| `pnpm test:e2e:offline` | Landing page only, backend down (host-only frontend rule) |
| `pnpm test:visual` | Visual regression inside the official Playwright Docker image |
| `pnpm test:visual:update` | Regenerate visual baselines (commit the diff; review deliberately) |
| `pnpm stripe:setup` | Seed Price + webhook secret into `.env` (loads `.env`; Docker required) |
| `pnpm stripe:seed` | Create test Product + monthly Price; print `STRIPE_PRICE_ID` (loads `.env`) |
| `pnpm backend:up` | `docker compose up -d --wait` (requires Docker) |
| `pnpm backend:down` | `docker compose down` |
| `pnpm backend:logs` | Follow emulator logs |

## Testing

Full policy: [AGENTS.md → Testing requirements](AGENTS.md#testing-requirements) (same-PR tests, regression tests that bite, coverage only up, no skip/weaken, PR body maps scope → tests).

### Unit + component

```bash
pnpm test              # Vitest unit project
pnpm test:component    # RTL + jsdom
pnpm test:coverage     # unit + component with V8 coverage thresholds
```

Landing polish before/after captures used in PR #6 live under [`docs/screenshots/`](docs/screenshots/) ([index](docs/screenshots/README.md)).

### Integration (Docker emulators)

```bash
pnpm backend:up
pnpm test:integration
```

Integration runs once in CI inside **Component + coverage** (`pnpm test:coverage`). The **Auth integration (emulators)** job only verifies Compose emulator health so the suites are not duplicated.

### E2E + accessibility (Playwright)

Start the backend and a production Next server, then run Playwright on the host:

```bash
cp -n .env.example .env
pnpm backend:up
pnpm build && pnpm start
# other terminal:
pnpm exec playwright install chromium   # once per machine
pnpm test:e2e
```

Offline landing (no emulators):

```bash
pnpm build && pnpm start
pnpm test:e2e:offline
```

On failure, Playwright writes `playwright-report/` and `test-results/` (traces). CI uploads those as artifacts.

### Visual regression

Baselines are **generated and compared inside** `mcr.microsoft.com/playwright:<pinned>` so local and CI pixels match. Docker is required.

```bash
cp -n .env.example .env
pnpm backend:up
pnpm build && pnpm start
# other terminal:
pnpm test:visual            # compare
pnpm test:visual:update     # rewrite e2e/*-snapshots/ — review in the PR
```

Update baselines only when the UI change is intentional. Do not regenerate to silence flakes.

### Optional `app` profile notes

The Compose `app` service builds from [`docker/app.Dockerfile`](docker/app.Dockerfile): dependencies are installed at **image build** time (not on every start), the process runs as `APP_UID`/`APP_GID` (default `1000:1000` — set these to your host ids on Linux so bind-mounted `.next` is writable), and a healthcheck probes `/api/health` so `docker compose --profile app up -d --wait` waits for the Next.js server.

`node_modules` uses an **anonymous** volume (seeded from the image). After lockfile changes, refresh modules with:

```bash
docker compose --profile app up --build --renew-anon-volumes
```

Or `docker compose down` then `up --build`. Do not rely on a named `app_node_modules` volume — it silently keeps stale installs.

## Documents and Firestore

Document CRUD goes through **Server Actions + the Firebase Admin SDK**. Browser clients never read or write `/documents` — `firestore.rules` default-denies create/update/delete/read for that collection (Architecture §5.6).

Title (**1–120** characters) and content (**≤ 512 KiB** UTF-8 bytes when serialised as Tiptap JSON) are enforced **server-side in Zod** (`src/features/documents/schemas.ts`), not in security rules.
