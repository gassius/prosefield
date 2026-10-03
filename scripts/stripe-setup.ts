/**
 * One-shot local Stripe setup: seed Price + webhook secret into `.env`.
 *
 * Usage: pnpm stripe:setup  (loads `.env` via `tsx --env-file-if-exists=.env`)
 * Requires Docker for `docker compose run --rm stripe-cli listen --print-secret`.
 * Never prints secret values. Refuses live keys.
 *
 * Stripe docs: the CLI webhook signing secret does not change between
 * `listen --print-secret` and a subsequent `listen --forward-to` with the same
 * API key, so the value written here matches `docker compose --profile stripe up`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { runStripeSetup } from "../src/lib/stripe/setup";
import { seedTestPrice } from "../src/lib/stripe/seed-test-price";
import {
  logStripeSetupFailure,
  printWebhookSecret,
} from "../src/lib/stripe/webhook-secret";

async function defaultSeedPriceId(secretKey: string): Promise<string> {
  const result = await seedTestPrice(secretKey, {
    planDisplayName: process.env.PLAN_DISPLAY_NAME,
    planDisplayPrice: process.env.PLAN_DISPLAY_PRICE,
    planDisplayCurrency: process.env.PLAN_DISPLAY_CURRENCY,
  });
  return result.priceId;
}

async function main() {
  try {
    await runStripeSetup({
      envFilePath: ".env",
      readFile: (path) => readFileSync(path, "utf8"),
      writeFile: (path, contents) => writeFileSync(path, contents, "utf8"),
      seedPriceId: defaultSeedPriceId,
      printWebhookSecret,
      log: (message) => console.log(message),
    });
  } catch (error: unknown) {
    logStripeSetupFailure(error);
    process.exit(1);
  }
}

void main();
