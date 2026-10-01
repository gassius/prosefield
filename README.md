# Prosefield

Local-first writing workspace. Specs live in [`docs/architecture.md`](docs/architecture.md) (v1.0) and [`docs/art-direction.md`](docs/art-direction.md) (v1.1).

## Quick start (Docker)

1. Prerequisite: Docker. A Stripe **test** account is free.
2. `cp .env.example .env`, then paste `STRIPE_SECRET_KEY` (`sk_test_…` only).
3. `docker compose up` — app on http://127.0.0.1:3000, Auth `:9099`, Firestore `:8080`, Emulator UI `:4000`.
4. Optional Stripe webhook forwarder (profile `stripe`):
   - Compose maps `STRIPE_SECRET_KEY` from `.env` to the CLI's `STRIPE_API_KEY`.
   - Print the webhook secret: `docker compose run --rm stripe-cli listen --print-secret`
   - Put that value in `.env` as `STRIPE_WEBHOOK_SECRET`, then `docker compose --profile stripe up`.

## Native path

Node 24 + pnpm (`corepack enable`), Java 21 for emulators:

```bash
cp .env.example .env
pnpm install
pnpm emulators   # separate terminal
pnpm dev
```

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Next.js dev server |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | Static checks |
| `pnpm emulators` | Firebase Auth + Firestore + UI (`demo-prosefield`) |
