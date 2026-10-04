import "server-only";

import { unstable_cache } from "next/cache";
import {
  formatPlanFromStripe,
  getPlanDisplay,
  type PlanDisplay,
} from "@/features/billing/plan-display";
import { isBillingConfigured } from "@/features/billing/configured";
import { getEnv } from "@/lib/env";
import { getStripe } from "@/lib/stripe/server";

async function fetchPlanFromStripe(): Promise<PlanDisplay> {
  const env = getEnv();
  const stripe = getStripe();
  const price = await stripe.prices.retrieve(env.STRIPE_PRICE_ID, {
    expand: ["product"],
  });

  if (!price.unit_amount || !price.recurring?.interval) {
    throw new Error("STRIPE_PRICE_ID must be a recurring price with unit_amount");
  }

  const product = price.product;
  const productName =
    typeof product === "object" && product && !("deleted" in product && product.deleted)
      ? product.name
      : env.PLAN_DISPLAY_NAME;

  return formatPlanFromStripe({
    name: productName || env.PLAN_DISPLAY_NAME,
    unitAmount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring.interval,
  });
}

const getCachedStripePlan = unstable_cache(
  async () => fetchPlanFromStripe(),
  ["prosefield-stripe-plan"],
  { revalidate: 3600 },
);

/**
 * Plan from `STRIPE_PRICE_ID` (cached ~1 h), with `PLAN_DISPLAY_*` fallback
 * when Stripe is not configured, env is incomplete, or unreachable (§5.2).
 * Must not throw during `pnpm build` without `.env` (same as main).
 */
export async function getPlan(): Promise<PlanDisplay> {
  // isBillingConfigured() never throws (returns false on env parse failure).
  if (!isBillingConfigured()) {
    return getPlanDisplay();
  }

  try {
    return await getCachedStripePlan();
  } catch (error) {
    const { logError } = await import("@/lib/logger");
    logError("[billing] getPlan Stripe retrieve failed; using display fallback", {
      code:
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : "unknown",
    });
    return getPlanDisplay();
  }
}

/** Uncached fetch for unit tests (bypasses Next cache). */
export async function __fetchPlanFromStripeForTests(): Promise<PlanDisplay> {
  return fetchPlanFromStripe();
}
