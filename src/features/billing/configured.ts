import "server-only";

import { getEnv, localDevDefaults, type Env } from "@/lib/env";

/**
 * True when Stripe is configured with real test credentials (not placeholders).
 * Local/CI defaults use `*_replaceme` so the app boots without keys.
 * Returns false when env cannot be parsed (e.g. `pnpm build` without `.env`).
 */
export function isBillingConfigured(env?: Env): boolean {
  let resolved: Env;
  try {
    resolved = env ?? getEnv();
  } catch {
    return false;
  }
  const secret = resolved.STRIPE_SECRET_KEY;
  const price = resolved.STRIPE_PRICE_ID;
  const webhook = resolved.STRIPE_WEBHOOK_SECRET;

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
