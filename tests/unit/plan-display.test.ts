import { afterEach, describe, expect, it, vi } from "vitest";
import { localDevDefaults } from "@/lib/env";

const PLAN_KEYS = [
  "PLAN_DISPLAY_NAME",
  "PLAN_DISPLAY_PRICE",
  "PLAN_DISPLAY_CURRENCY",
  "PLAN_DISPLAY_INTERVAL",
] as const;

describe("getPlanDisplay", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("formats the default EUR plan as a fixed euro checkout line", async () => {
    for (const key of PLAN_KEYS) {
      delete process.env[key];
    }
    const { getPlanDisplay } = await import("@/features/billing/plan-display");
    const plan = getPlanDisplay();
    expect(plan.price).toBe(localDevDefaults.PLAN_DISPLAY_PRICE);
    expect(plan.checkoutReassurance).toBe("€8/month · Secure checkout");
    expect(plan.checkoutReassurance).not.toContain("EUR");
  });

  it("uses the euro sign for EUR and keeps the price in the label", async () => {
    vi.stubEnv("PLAN_DISPLAY_NAME", "Prosefield");
    vi.stubEnv("PLAN_DISPLAY_PRICE", "12");
    vi.stubEnv("PLAN_DISPLAY_CURRENCY", "EUR");
    vi.stubEnv("PLAN_DISPLAY_INTERVAL", "month");
    vi.resetModules();
    const { getPlanDisplay } = await import("@/features/billing/plan-display");
    expect(getPlanDisplay().checkoutReassurance).toBe(
      "€12/month · Secure checkout",
    );
  });

  it("falls back to a currency code prefix for unknown currencies", async () => {
    vi.stubEnv("PLAN_DISPLAY_NAME", "Prosefield");
    vi.stubEnv("PLAN_DISPLAY_PRICE", "10");
    vi.stubEnv("PLAN_DISPLAY_CURRENCY", "SEK");
    vi.stubEnv("PLAN_DISPLAY_INTERVAL", "month");
    vi.resetModules();
    const { getPlanDisplay } = await import("@/features/billing/plan-display");
    expect(getPlanDisplay().checkoutReassurance).toBe(
      "SEK 10/month · Secure checkout",
    );
  });

  it("formats fractional Stripe amounts and non-EUR currencies", async () => {
    const { formatPlanFromStripe } = await import(
      "@/features/billing/plan-display"
    );
    const fractional = formatPlanFromStripe({
      name: "Prosefield",
      unitAmount: 850,
      currency: "eur",
      interval: "month",
    });
    expect(fractional.priceLabel).toBe("€8.5/month");

    const usd = formatPlanFromStripe({
      name: "Prosefield",
      unitAmount: 999,
      currency: "usd",
      interval: "month",
    });
    expect(usd.priceLabel).toBe("$9.99/month");

    const jpy = formatPlanFromStripe({
      name: "Prosefield",
      unitAmount: 1000,
      currency: "jpy",
      interval: "month",
    });
    expect(jpy.priceLabel).toMatch(/\/month$/);
    expect(jpy.priceLabel).not.toMatch(/^€/);
  });
});
