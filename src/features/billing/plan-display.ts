import "server-only";

import { localDevDefaults } from "@/lib/env";

const currencySymbols: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
};

function readPlanField(
  key:
    | "PLAN_DISPLAY_NAME"
    | "PLAN_DISPLAY_PRICE"
    | "PLAN_DISPLAY_CURRENCY"
    | "PLAN_DISPLAY_INTERVAL",
): string {
  const fromEnv = process.env[key]?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  // Soft fallback so `pnpm build` without `.env` still prerenders (same as main).
  // Production runtime should still set PLAN_DISPLAY_*; getEnv() remains required elsewhere.
  return localDevDefaults[key];
}

/**
 * Plan display fallback from `PLAN_DISPLAY_*` env.
 * TODO(P2 Billing / getPlan): replace with Stripe Price when billing lands.
 * Default display price is €8/month (Art Direction v1.1 / PLAN_DISPLAY_* defaults).
 *
 * Does not call `getEnv()` so a missing full env does not break marketing prerender.
 */
export function getPlanDisplay() {
  const name = readPlanField("PLAN_DISPLAY_NAME");
  const price = readPlanField("PLAN_DISPLAY_PRICE");
  const currency = readPlanField("PLAN_DISPLAY_CURRENCY");
  const interval = readPlanField("PLAN_DISPLAY_INTERVAL");
  const symbol = currencySymbols[currency] ?? `${currency} `;
  const priceLabel = `${symbol}${price}/${interval}`;
  return {
    name,
    price,
    currency,
    interval,
    priceLabel,
    checkoutReassurance: `${priceLabel} · Secure checkout`,
  };
}
