import "server-only";

import { getEnv } from "@/lib/env";

const currencySymbols: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
};

/**
 * Plan display fallback from `PLAN_DISPLAY_*` env.
 * TODO(P2 Billing / getPlan): replace with Stripe Price when billing lands.
 * Default price left as configured in env (Carlos confirming Art Direction €8).
 */
export function getPlanDisplay() {
  const env = getEnv();
  const symbol =
    currencySymbols[env.PLAN_DISPLAY_CURRENCY] ??
    `${env.PLAN_DISPLAY_CURRENCY} `;
  const priceLabel = `${symbol}${env.PLAN_DISPLAY_PRICE}/${env.PLAN_DISPLAY_INTERVAL}`;
  return {
    name: env.PLAN_DISPLAY_NAME,
    price: env.PLAN_DISPLAY_PRICE,
    currency: env.PLAN_DISPLAY_CURRENCY,
    interval: env.PLAN_DISPLAY_INTERVAL,
    priceLabel,
    checkoutReassurance: `${priceLabel} · Secure checkout`,
  };
}
