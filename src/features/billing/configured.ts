import "server-only";

import { getEnv, localDevDefaults, type Env } from "@/lib/env";

/**
 * True when Stripe is configured with real test credentials (not placeholders).
 * Local/CI defaults use `*_replaceme` so the app boots without keys.
 */
export function isBillingConfigured(env: Env = getEnv()): boolean {
  const secret = env.STRIPE_SECRET_KEY;
  const price = env.STRIPE_PRICE_ID;
  const webhook = env.STRIPE_WEBHOOK_SECRET;

  if (
    secret === localDevDefaults.STRIPE_SECRET_KEY ||
    price === localDevDefaults.STRIPE_PRICE_ID ||
    webhook === localDevDefaults.STRIPE_WEBHOOK_SECRET
  ) {
    return false;
  }

  if (
    secret.includes("replaceme") ||
    price.includes("replaceme") ||
    webhook.includes("replaceme")
  ) {
    return false;
  }

  return true;
}

export const BILLING_NOT_CONFIGURED_MESSAGE =
  "Billing is not configured. Set STRIPE_SECRET_KEY, STRIPE_PRICE_ID, and STRIPE_WEBHOOK_SECRET in your environment (see README).";
