import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FAKE_STRIPE_PRICE_ID,
  FAKE_STRIPE_SECRET_KEY,
  FAKE_STRIPE_WEBHOOK_SECRET,
} from "../fixtures/stripe";


describe("getStripe", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns a cached Stripe client for the configured secret", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", FAKE_STRIPE_WEBHOOK_SECRET);
    vi.stubEnv("STRIPE_PRICE_ID", FAKE_STRIPE_PRICE_ID);
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    const { getStripe, __resetStripeClientForTests } = await import(
      "@/lib/stripe/server"
    );
    __resetStripeClientForTests();
    const a = getStripe();
    const b = getStripe();
    expect(a).toBe(b);
  });
});
