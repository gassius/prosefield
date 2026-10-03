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

  it("points prices.retrieve at STRIPE_API_HOST when set (CI visual mock)", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", FAKE_STRIPE_WEBHOOK_SECRET);
    vi.stubEnv("STRIPE_PRICE_ID", FAKE_STRIPE_PRICE_ID);
    vi.stubEnv("STRIPE_API_HOST", "127.0.0.1");
    vi.stubEnv("STRIPE_API_PORT", "12111");
    vi.stubEnv("STRIPE_API_PROTOCOL", "http");
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    const { getStripe, __resetStripeClientForTests } = await import(
      "@/lib/stripe/server"
    );
    __resetStripeClientForTests();
    const stripe = getStripe();
    // stripe-node stores API config on _api (not part of the public type).
    const api = (
      stripe as unknown as {
        _api: { host: string; port: string | number; protocol: string };
      }
    )._api;
    expect(api.host).toBe("127.0.0.1");
    expect(Number(api.port)).toBe(12111);
    expect(api.protocol).toBe("http");
  });
});
