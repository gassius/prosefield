import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FAKE_STRIPE_PRICE_ID,
  FAKE_STRIPE_SECRET_KEY,
  FAKE_STRIPE_WEBHOOK_SECRET,
  PLACEHOLDER_STRIPE_PRICE_ID,
  PLACEHOLDER_STRIPE_SECRET_KEY,
  PLACEHOLDER_STRIPE_WEBHOOK_SECRET,
} from "../fixtures/stripe";

const constructStripeEvent = vi.fn();
const handleStripeEvent = vi.fn();

vi.mock("@/features/billing/webhook", () => ({
  constructStripeEvent: (rawBody: string, signature: string | null) =>
    constructStripeEvent(rawBody, signature),
  handleStripeEvent: (event: unknown) => handleStripeEvent(event),
}));

describe("POST /api/stripe/webhook route", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns 503 before constructEvent when billing is unconfigured", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", PLACEHOLDER_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_PRICE_ID", PLACEHOLDER_STRIPE_PRICE_ID);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", PLACEHOLDER_STRIPE_WEBHOOK_SECRET);
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const response = await POST(
      new Request("http://localhost:3000/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=anything" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(503);
    expect(constructStripeEvent).not.toHaveBeenCalled();
  });

  it("verifies signature when configured", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_PRICE_ID", FAKE_STRIPE_PRICE_ID);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", FAKE_STRIPE_WEBHOOK_SECRET);
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();

    constructStripeEvent.mockReturnValue({
      id: "evt_1",
      type: "customer.subscription.updated",
    });
    handleStripeEvent.mockResolvedValue({
      handled: true,
      processed: true,
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const response = await POST(
      new Request("http://localhost:3000/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "raw",
      }),
    );
    expect(response.status).toBe(200);
    expect(constructStripeEvent).toHaveBeenCalledWith("raw", "sig");
  });
});
