import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FAKE_STRIPE_PRICE_ID,
  FAKE_STRIPE_SECRET_KEY,
  FAKE_STRIPE_WEBHOOK_SECRET,
  PLACEHOLDER_STRIPE_PRICE_ID,
  PLACEHOLDER_STRIPE_SECRET_KEY,
  PLACEHOLDER_STRIPE_WEBHOOK_SECRET,
} from "../fixtures/stripe";


const retrievePrice = vi.fn();

vi.mock("@/lib/stripe/server", () => ({
  getStripe: () => ({
    prices: { retrieve: retrievePrice },
  }),
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => fn,
}));

describe("getPlan", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns PLAN_DISPLAY_* fallback when billing is not configured", async () => {
    vi.stubEnv("PLAN_DISPLAY_PRICE", "8");
    vi.stubEnv("PLAN_DISPLAY_CURRENCY", "EUR");
    vi.stubEnv("PLAN_DISPLAY_INTERVAL", "month");
    vi.stubEnv("STRIPE_SECRET_KEY", PLACEHOLDER_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_PRICE_ID", PLACEHOLDER_STRIPE_PRICE_ID);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", PLACEHOLDER_STRIPE_WEBHOOK_SECRET);

    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    const { getPlan } = await import("@/features/billing/plan");
    const plan = await getPlan();
    expect(plan.checkoutReassurance).toBe("€8/month · Secure checkout");
    expect(retrievePrice).not.toHaveBeenCalled();
  });

  it("retrieves Stripe Price when configured", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", FAKE_STRIPE_WEBHOOK_SECRET);
    vi.stubEnv("STRIPE_PRICE_ID", FAKE_STRIPE_PRICE_ID);
    vi.stubEnv("PLAN_DISPLAY_NAME", "Prosefield");
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();

    retrievePrice.mockResolvedValue({
      unit_amount: 800,
      currency: "eur",
      recurring: { interval: "month" },
      product: { name: "Prosefield Writer", deleted: false },
    });

    const { __fetchPlanFromStripeForTests } = await import(
      "@/features/billing/plan"
    );
    const plan = await __fetchPlanFromStripeForTests();
    expect(plan.name).toBe("Prosefield Writer");
    expect(plan.priceLabel).toBe("€8/month");
    expect(retrievePrice).toHaveBeenCalledWith(FAKE_STRIPE_PRICE_ID, {
      expand: ["product"],
    });
  });

  it("falls back when Stripe retrieve fails", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", FAKE_STRIPE_WEBHOOK_SECRET);
    vi.stubEnv("STRIPE_PRICE_ID", FAKE_STRIPE_PRICE_ID);
    vi.stubEnv("PLAN_DISPLAY_PRICE", "8");
    vi.stubEnv("PLAN_DISPLAY_CURRENCY", "EUR");
    vi.stubEnv("PLAN_DISPLAY_INTERVAL", "month");
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    retrievePrice.mockRejectedValue(new Error("network"));

    const { getPlan } = await import("@/features/billing/plan");
    const plan = await getPlan();
    expect(plan.checkoutReassurance).toBe("€8/month · Secure checkout");
  });

  it("falls back when isBillingConfigured throws (missing env)", async () => {
    vi.stubEnv("PLAN_DISPLAY_PRICE", "8");
    vi.stubEnv("PLAN_DISPLAY_CURRENCY", "EUR");
    vi.stubEnv("PLAN_DISPLAY_INTERVAL", "month");
    vi.resetModules();
    vi.doMock("@/features/billing/configured", () => ({
      isBillingConfigured: () => {
        throw new Error("ZodError: missing env");
      },
    }));
    const { getPlan } = await import("@/features/billing/plan");
    const plan = await getPlan();
    expect(plan.checkoutReassurance).toBe("€8/month · Secure checkout");
    expect(retrievePrice).not.toHaveBeenCalled();
  });

  it("fetchPlanFromStripe rejects non-recurring prices", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", FAKE_STRIPE_WEBHOOK_SECRET);
    vi.stubEnv("STRIPE_PRICE_ID", FAKE_STRIPE_PRICE_ID);
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    retrievePrice.mockResolvedValue({
      unit_amount: null,
      currency: "eur",
      recurring: null,
      product: "prod_deleted",
    });
    const { __fetchPlanFromStripeForTests } = await import(
      "@/features/billing/plan"
    );
    await expect(__fetchPlanFromStripeForTests()).rejects.toThrow(/recurring/i);
  });

  it("uses display name when Stripe product is deleted", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", FAKE_STRIPE_WEBHOOK_SECRET);
    vi.stubEnv("STRIPE_PRICE_ID", FAKE_STRIPE_PRICE_ID);
    vi.stubEnv("PLAN_DISPLAY_NAME", "Prosefield");
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    retrievePrice.mockResolvedValue({
      unit_amount: 800,
      currency: "eur",
      recurring: { interval: "month" },
      product: { id: "prod_x", deleted: true },
    });
    const { __fetchPlanFromStripeForTests } = await import(
      "@/features/billing/plan"
    );
    const plan = await __fetchPlanFromStripeForTests();
    expect(plan.name).toBe("Prosefield");
  });

  it("falls back when Stripe fails with a coded error", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", FAKE_STRIPE_WEBHOOK_SECRET);
    vi.stubEnv("STRIPE_PRICE_ID", FAKE_STRIPE_PRICE_ID);
    vi.stubEnv("PLAN_DISPLAY_PRICE", "8");
    vi.stubEnv("PLAN_DISPLAY_CURRENCY", "EUR");
    vi.stubEnv("PLAN_DISPLAY_INTERVAL", "month");
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    retrievePrice.mockRejectedValue({ code: "rate_limit" });

    const { getPlan } = await import("@/features/billing/plan");
    const plan = await getPlan();
    expect(plan.checkoutReassurance).toBe("€8/month · Secure checkout");
  });
});
