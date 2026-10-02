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

export type PlanDisplay = {
  name: string;
  price: string;
  currency: string;
  interval: string;
  priceLabel: string;
  checkoutReassurance: string;
};

/**
 * Plan display fallback from `PLAN_DISPLAY_*` env (Art Direction €8/month defaults).
 * Used when Stripe is unreachable or not configured. Prefer `getPlan()` for pages.
 *
 * Does not call `getEnv()` so a missing full env does not break marketing prerender.
 */
export function getPlanDisplay(): PlanDisplay {
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

export function formatPlanFromStripe(input: {
  name: string;
  unitAmount: number;
  currency: string;
  interval: string;
}): PlanDisplay {
  const currency = input.currency.toUpperCase();
  const major = input.unitAmount / 100;
  const price = Number.isInteger(major)
    ? String(major)
    : major.toFixed(2).replace(/\.?0+$/, "");
  const formatted = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(major);
  // Prefer symbol form for EUR (€8/month) matching Art Direction.
  const symbol = currencySymbols[currency];
  const priceLabel = symbol
    ? `${symbol}${price}/${input.interval}`
    : `${formatted}/${input.interval}`;
  return {
    name: input.name,
    price,
    currency,
    interval: input.interval,
    priceLabel,
    checkoutReassurance: `${priceLabel} · Secure checkout`,
  };
}
