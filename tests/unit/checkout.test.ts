import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FAKE_STRIPE_PRICE_ID,
  FAKE_STRIPE_SECRET_KEY,
  FAKE_STRIPE_WEBHOOK_SECRET,
  PLACEHOLDER_STRIPE_PRICE_ID,
  PLACEHOLDER_STRIPE_SECRET_KEY,
  PLACEHOLDER_STRIPE_WEBHOOK_SECRET,
} from "../fixtures/stripe";


const customersCreate = vi.fn();
const sessionsCreate = vi.fn();

vi.mock("@/lib/stripe/server", () => ({
  getStripe: () => ({
    customers: { create: customersCreate },
    checkout: { sessions: { create: sessionsCreate } },
  }),
}));

vi.mock("@/features/billing/projection", () => ({
  getSubscriptionProjection: vi.fn(),
}));

vi.mock("@/features/billing/customers", async () => {
  return {
    getOrCreateStripeCustomer: vi.fn(async () => "cus_test"),
  };
});

describe("createCheckoutSession", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("throws not_configured for placeholder Stripe keys", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", PLACEHOLDER_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_PRICE_ID", PLACEHOLDER_STRIPE_PRICE_ID);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", PLACEHOLDER_STRIPE_WEBHOOK_SECRET);
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    const { createCheckoutSession, CheckoutError } = await import(
      "@/features/billing/checkout"
    );
    await expect(
      createCheckoutSession({ uid: "u1", email: "a@b.co" }),
    ).rejects.toBeInstanceOf(CheckoutError);
  });

  it("throws already_active when projection is active", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", FAKE_STRIPE_WEBHOOK_SECRET);
    vi.stubEnv("STRIPE_PRICE_ID", FAKE_STRIPE_PRICE_ID);
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    const projection = await import("@/features/billing/projection");
    vi.mocked(projection.getSubscriptionProjection).mockResolvedValue({
      status: "active",
    } as never);

    const { createCheckoutSession, CheckoutError } = await import(
      "@/features/billing/checkout"
    );
    await expect(
      createCheckoutSession({ uid: "u1", email: "a@b.co" }),
    ).rejects.toMatchObject({ code: "already_active" });
    expect(CheckoutError).toBeTruthy();
  });

  it("creates a subscription Checkout Session with firebaseUid metadata", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", FAKE_STRIPE_WEBHOOK_SECRET);
    vi.stubEnv("STRIPE_PRICE_ID", FAKE_STRIPE_PRICE_ID);
    vi.stubEnv("APP_URL", "http://localhost:3000");
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    const projection = await import("@/features/billing/projection");
    vi.mocked(projection.getSubscriptionProjection).mockResolvedValue(null);
    sessionsCreate.mockResolvedValue({
      id: "cs_test",
      url: "https://checkout.stripe.com/c/pay/cs_test",
    });

    const { createCheckoutSession } = await import(
      "@/features/billing/checkout"
    );
    const result = await createCheckoutSession({
      uid: "uid_1",
      email: "writer@example.com",
    });
    expect(result.url).toContain("checkout.stripe.com");
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer: "cus_test",
        client_reference_id: "uid_1",
        line_items: [{ price: FAKE_STRIPE_PRICE_ID, quantity: 1 }],
        subscription_data: { metadata: { firebaseUid: "uid_1" } },
        success_url:
          "http://localhost:3000/billing/status?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "http://localhost:3000/subscribe",
      }),
    );
  });
});
