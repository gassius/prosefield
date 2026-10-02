import "server-only";

import Stripe from "stripe";
import { getEnv } from "@/lib/env";

let cached: Stripe | undefined;

/**
 * Server-only Stripe client (test mode keys only — enforced by env.ts).
 */
export function getStripe(): Stripe {
  if (!cached) {
    const { STRIPE_SECRET_KEY } = getEnv();
    cached = new Stripe(STRIPE_SECRET_KEY, {
      typescript: true,
    });
  }
  return cached;
}

/** Test-only: clear the cached Stripe client. */
export function __resetStripeClientForTests(): void {
  cached = undefined;
}
