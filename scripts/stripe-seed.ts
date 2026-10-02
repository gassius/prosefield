/**
 * Creates a test Product + monthly Price in the evaluator's Stripe test account
 * and prints STRIPE_PRICE_ID (Architecture §5.2).
 *
 * Usage: STRIPE_SECRET_KEY=sk_test_… pnpm stripe:seed
 * Never commits keys. Rejects live keys.
 */
import Stripe from "stripe";

function main() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    console.error(
      "Missing STRIPE_SECRET_KEY. Export a test key (sk_test_…) then re-run.",
    );
    process.exit(1);
  }
  if (!key.startsWith("sk_test_")) {
    console.error("Refusing to run: STRIPE_SECRET_KEY must be a sk_test_ key.");
    process.exit(1);
  }
  if (key.includes("replaceme")) {
    console.error(
      "STRIPE_SECRET_KEY looks like a placeholder. Paste your real Stripe test secret key.",
    );
    process.exit(1);
  }

  const name = process.env.PLAN_DISPLAY_NAME?.trim() || "Prosefield";
  const amountEnv = process.env.PLAN_DISPLAY_PRICE?.trim() || "8";
  const currency = (process.env.PLAN_DISPLAY_CURRENCY?.trim() || "eur").toLowerCase();
  const unitAmount = Math.round(Number(amountEnv) * 100);
  if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
    console.error(`Invalid PLAN_DISPLAY_PRICE: ${amountEnv}`);
    process.exit(1);
  }

  const stripe = new Stripe(key);

  void (async () => {
    const product = await stripe.products.create({
      name,
      metadata: { prosefield: "seed" },
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: unitAmount,
      currency,
      recurring: { interval: "month" },
    });

    console.log("");
    console.log("Stripe test Product and Price created.");
    console.log(`Product: ${product.id} (${product.name})`);
    console.log(`Price:   ${price.id}`);
    console.log("");
    console.log("Add this to your .env:");
    console.log(`STRIPE_PRICE_ID=${price.id}`);
    console.log("");
  })().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("stripe:seed failed:", message);
    process.exit(1);
  });
}

main();
