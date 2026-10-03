/**
 * One-shot local Stripe setup: seed Price + webhook secret into `.env`.
 *
 * Usage: pnpm stripe:setup  (loads `.env` via `tsx --env-file=.env`)
 * Requires Docker for `docker compose run --rm stripe-cli listen --print-secret`.
 * Never prints secret values. Refuses live keys.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runStripeSetup, StripeSetupError } from "../src/lib/stripe/setup";
import { seedTestPrice } from "../src/lib/stripe/seed-test-price";

const execFileAsync = promisify(execFile);

async function defaultSeedPriceId(secretKey: string): Promise<string> {
  const result = await seedTestPrice(secretKey, {
    planDisplayName: process.env.PLAN_DISPLAY_NAME,
    planDisplayPrice: process.env.PLAN_DISPLAY_PRICE,
    planDisplayCurrency: process.env.PLAN_DISPLAY_CURRENCY,
  });
  return result.priceId;
}

async function printWebhookSecret(): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(
      "docker",
      ["compose", "run", "--rm", "stripe-cli", "listen", "--print-secret"],
      {
        env: process.env,
        maxBuffer: 1024 * 1024,
      },
    );
    const fromOut = stdout.trim();
    if (fromOut) {
      return fromOut;
    }
    // Some CLI builds print to stderr; still do not log it.
    return stderr.trim();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // Strip any accidental secret-looking tokens from the error text.
    const scrubbed = message.replace(/whsec_[A-Za-z0-9]+/g, "whsec_[redacted]");
    throw new StripeSetupError(
      `Failed to run stripe-cli listen --print-secret. Is Docker running? (${scrubbed})`,
    );
  }
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
    const message = error instanceof Error ? error.message : String(error);
    const scrubbed = message
      .replace(/whsec_[A-Za-z0-9]+/g, "whsec_[redacted]")
      .replace(/sk_(?:test|live)_[A-Za-z0-9]+/g, "sk_[redacted]")
      .replace(/rk_(?:test|live)_[A-Za-z0-9]+/g, "rk_[redacted]");
    console.error("stripe:setup failed:", scrubbed);
    process.exit(1);
  }
}

void main();
