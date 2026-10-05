# Testing

Full policy: [AGENTS.md → Testing requirements](../AGENTS.md#testing-requirements) (same-PR tests, regression tests that bite, coverage only up, no skip/weaken, PR body maps scope → tests).

Commands below match [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). Copy the env blocks with the commands so local runs match CI.

## Unit + component

```bash
pnpm test              # Vitest unit project
pnpm test:component    # RTL + jsdom
```

## Coverage + integration (Docker emulators)

Integration runs inside **Component + coverage** (`pnpm test:coverage`). Start emulators first, then set the same hosts CI uses:

```bash
cp -n .env.example .env
pnpm backend:up

export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export APP_URL=http://localhost:3000

pnpm test:coverage
# or only integration:
pnpm test:integration
```

The separate CI **Auth integration (emulators)** job only verifies Compose emulator health so the suites are not duplicated.

## E2E + accessibility (Playwright)

Build and start a production Next server with emulators allowed, then run Playwright on the host:

```bash
cp -n .env.example .env
pnpm backend:up

export ALLOW_EMULATORS=1
export APP_URL=http://localhost:3000
pnpm build
pnpm start --hostname 127.0.0.1 --port 3000
```

In another terminal (with emulators still up):

```bash
export APP_URL=http://localhost:3000
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_PROJECT_ID=demo-prosefield

pnpm exec playwright install chromium   # once per machine
pnpm test:e2e
```

### Offline landing (no emulators)

```bash
export ALLOW_EMULATORS=1
export APP_URL=http://localhost:3000
pnpm build
pnpm start --hostname 127.0.0.1 --port 3000
# other terminal:
pnpm test:e2e:offline
```

On failure, Playwright writes `playwright-report/` and `test-results/` (traces). CI uploads those as artifacts.

## Visual regression

Baselines are **generated and compared inside** `mcr.microsoft.com/playwright:<pinned>` so local and CI pixels match. Docker is required.

The **configured checkout** visual (`e2e/visual.spec.ts`, “logged-in subscribe configured checkout button”) needs non-placeholder Stripe env on the Next server. CI starts `scripts/stripe-prices-mock-server.mjs` and points Stripe SDK host/port at that mock — no calls to `api.stripe.com`.

```bash
cp -n .env.example .env
pnpm backend:up

export ALLOW_EMULATORS=1
export APP_URL=http://localhost:3000
pnpm build

# Same pattern as CI visual job: join prefix+body so docs never contain a
# contiguous sk_test_/whsec_ value (gitleaks). No real Stripe calls — prices
# hit the local mock below, not api.stripe.com.
SK_PREFIX='sk_test'
SK_BODY='visualbaseline01'
export STRIPE_SECRET_KEY="${SK_PREFIX}_${SK_BODY}"
WH_PREFIX='whsec'
WH_BODY='visualbaseline01'
export STRIPE_WEBHOOK_SECRET="${WH_PREFIX}_${WH_BODY}"
export STRIPE_PRICE_ID='price_visualbaseline01'
export STRIPE_API_HOST=127.0.0.1
export STRIPE_API_PORT=12111
export STRIPE_API_PROTOCOL=http

node scripts/stripe-prices-mock-server.mjs &
pnpm start --hostname 127.0.0.1 --port 3000
```

In another terminal:

```bash
export APP_URL=http://localhost:3000
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_PROJECT_ID=demo-prosefield

pnpm test:visual            # compare
pnpm test:visual:update     # rewrite e2e/*-snapshots/ — review in the PR
```

Update baselines only when the UI change is intentional. Do not regenerate to silence flakes.

Demo GIFs (`pnpm demo:gifs`) are **not** part of the visual-regression gate.

## Scripts (test-related)

| Command | Purpose |
|---|---|
| `pnpm test` | Vitest unit project |
| `pnpm test:component` | React Testing Library component suite (jsdom) |
| `pnpm test:coverage` | Unit + component + integration with V8 coverage thresholds (needs emulators) |
| `pnpm test:integration` | Session/guard tests against running emulators (`pnpm backend:up` first) |
| `pnpm test:e2e` | Playwright Chromium E2E + axe a11y (app + emulators running) |
| `pnpm test:e2e:offline` | Landing page only, backend down (host-only frontend rule) |
| `pnpm test:visual` | Visual regression inside the official Playwright Docker image |
| `pnpm test:visual:update` | Regenerate visual baselines (commit the diff; review deliberately) |
