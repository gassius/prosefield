/**
 * Creates a test Product + monthly Price (Architecture §5.2).
 * Used by `pnpm stripe:seed` and `pnpm stripe:setup`.
 */
import Stripe from "stripe";
import { assertStripeTestSecretKey } from "@/lib/stripe/dev-env";

export type SeedTestPriceOptions = {
  planDisplayName?: string;
  planDisplayPrice?: string;
  planDisplayCurrency?: string;
  /** Injected for tests; defaults to a real Stripe client. */
  createStripe?: (secretKey: string) => Stripe;
};

export type SeedTestPriceResult = {
  productId: string;
  priceId: string;
  productName: string;
};

export async function seedTestPrice(
  secretKey: string | undefined,
  options: SeedTestPriceOptions = {},
): Promise<SeedTestPriceResult> {
  assertStripeTestSecretKey(secretKey);

  const name = options.planDisplayName?.trim() || "Prosefield";
  const amountEnv = options.planDisplayPrice?.trim() || "8";
  const currency = (
    options.planDisplayCurrency?.trim() || "eur"
  ).toLowerCase();
  const unitAmount = Math.round(Number(amountEnv) * 100);
  if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
    throw new Error(`Invalid PLAN_DISPLAY_PRICE: ${amountEnv}`);
  }

  const createStripe =
    options.createStripe ?? ((key: string) => new Stripe(key));
  const stripe = createStripe(secretKey);

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

  return {
    productId: product.id,
    priceId: price.id,
    productName: product.name,
  };
}
