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
    expect(plan.checkoutReassurance).toBe("€9/month · Secure checkout");
    expect(plan.checkoutReassurance).not.toContain("EUR");
    expect(plan.checkoutReassurance).not.toBe("€8/month · Secure checkout");
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
});
