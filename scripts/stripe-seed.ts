/**
 * Creates a test Product + monthly Price in the evaluator's Stripe test account
 * and prints STRIPE_PRICE_ID (Architecture §5.2).
 *
 * Usage: pnpm stripe:seed  (loads `.env` via `tsx --env-file-if-exists=.env`)
 * Never commits keys. Rejects live keys.
 */
import { seedTestPrice } from "../src/lib/stripe/seed-test-price";

async function main() {
  try {
    const result = await seedTestPrice(process.env.STRIPE_SECRET_KEY, {
      planDisplayName: process.env.PLAN_DISPLAY_NAME,
      planDisplayPrice: process.env.PLAN_DISPLAY_PRICE,
      planDisplayCurrency: process.env.PLAN_DISPLAY_CURRENCY,
    });

    console.log("");
    console.log("Stripe test Product and Price created.");
    console.log(`Product: ${result.productId} (${result.productName})`);
    console.log(`Price:   ${result.priceId}`);
    console.log("");
    console.log("Add this to your .env (or run pnpm stripe:setup):");
    console.log(`STRIPE_PRICE_ID=${result.priceId}`);
    console.log("");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("stripe:seed failed:", message);
    process.exit(1);
  }
}

void main();
