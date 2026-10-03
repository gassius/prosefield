import "server-only";

import Stripe from "stripe";
import { getEnv } from "@/lib/env";

let cached: Stripe | undefined;

/**
 * Optional local/CI Stripe API override (e.g. visual job mock).
 * When unset, the SDK talks to api.stripe.com as usual.
 */
function stripeApiOverride():
  | Pick<Stripe.StripeConfig, "host" | "port" | "protocol">
  | undefined {
  const host = process.env.STRIPE_API_HOST?.trim();
  if (!host) {
    return undefined;
  }
  const portRaw = process.env.STRIPE_API_PORT?.trim();
  const port = portRaw ? Number(portRaw) : 12111;
  const protocol =
    process.env.STRIPE_API_PROTOCOL?.trim() === "https" ? "https" : "http";
  return { host, port, protocol };
}

/**
 * Server-only Stripe client (test mode sk_test_/rk_test_ keys — enforced by env.ts).
 */
export function getStripe(): Stripe {
  if (!cached) {
    const { STRIPE_SECRET_KEY } = getEnv();
    const override = stripeApiOverride();
    cached = new Stripe(STRIPE_SECRET_KEY, {
      typescript: true,
      ...(override ?? {}),
    });
  }
  return cached;
}

/** Test-only: clear the cached Stripe client. */
export function __resetStripeClientForTests(): void {
  cached = undefined;
}
