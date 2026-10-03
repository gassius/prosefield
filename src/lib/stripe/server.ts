import "server-only";

import Stripe from "stripe";
import { getEnv } from "@/lib/env";

let cached: Stripe | undefined;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Optional local/CI Stripe API override (e.g. visual job mock on loopback).
 * When unset — or when HOST is non-loopback without an explicit allow flag —
 * the SDK talks to api.stripe.com as usual. Default protocol is https so a
 * mis-set HOST never silently downgrades to cleartext.
 *
 * Non-loopback override requires STRIPE_API_ALLOW_NON_LOOPBACK=1 (CI-only).
 * NODE_ENV cannot gate this: the visual job runs `next start`.
 */
function stripeApiOverride():
  | Pick<Stripe.StripeConfig, "host" | "port" | "protocol">
  | undefined {
  const host = process.env.STRIPE_API_HOST?.trim();
  if (!host) {
    return undefined;
  }
  const allowNonLoopback = process.env.STRIPE_API_ALLOW_NON_LOOPBACK === "1";
  if (!LOOPBACK_HOSTS.has(host) && !allowNonLoopback) {
    return undefined;
  }
  const port = Number(process.env.STRIPE_API_PORT || "12111");
  const protocol: "http" | "https" =
    process.env.STRIPE_API_PROTOCOL === "http" ? "http" : "https";
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
