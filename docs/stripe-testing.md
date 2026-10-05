# Stripe test payment

CI never needs real Stripe credentials or network. Use this guide for a local end-to-end payment with **test-mode** keys.

## Quick path

1. Put your `sk_test_…` or `rk_test_…` in `.env` as `STRIPE_SECRET_KEY` (never commit `.env`).
2. Run `pnpm stripe:setup` — seeds a Price, writes `STRIPE_PRICE_ID` into `.env`, runs `docker compose run --rm stripe-cli listen --print-secret`, and writes `STRIPE_WEBHOOK_SECRET` into `.env` (updates in place; never prints secret values). Requires Docker. Per [Stripe CLI docs](https://docs.stripe.com/cli/listen), the webhook signing secret does **not** change between `listen --print-secret` and a later `listen --forward-to` with the same API key, so this value matches the long-running `stripe` profile listener.
3. Start Next.js **in Docker** with the Stripe CLI forwarder (both own the Compose `app` / `stripe` profiles). Skip host `pnpm dev` — the `app` service also binds `:3000`:

   ```bash
   docker compose --profile app --profile stripe up
   ```

4. Register, open `/subscribe`, continue to Checkout, pay with `4242 4242 4242 4242` (any future expiry, any CVC). You should land on `/billing/status`, then `/documents` once the verified webhook (or session-sync fallback) projects `status: active`.

## When billing is configured

`/subscribe` stays **Billing is not configured** until all three of `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET` are set to non-placeholder values. Without them the app still boots: plan display falls back to `PLAN_DISPLAY_*` (€8/month).

Compose maps `STRIPE_SECRET_KEY` from `.env` to the CLI's `STRIPE_API_KEY`. For a webhook secret alone (without re-seeding):

```bash
docker compose run --rm stripe-cli listen --print-secret
```

(`pnpm stripe:seed` / `pnpm stripe:setup` use `tsx --env-file-if-exists=.env`, so exporting `STRIPE_SECRET_KEY=…` without a `.env` file still works.)

## Playwright and CI

Playwright acceptance tests mock payment by seeding the Firestore entitlement projection in the emulator (Architecture §13) — a test-only shortcut with no production equivalent.

Visual regression’s “configured checkout” case needs non-placeholder Stripe env on the Next server and a local prices mock (`scripts/stripe-prices-mock-server.mjs`). See [`docs/testing.md`](testing.md#visual-regression).
