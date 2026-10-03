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
const sessionsList = vi.fn();
const subscriptionsList = vi.fn();

vi.mock("@/lib/stripe/server", () => ({
  getStripe: () => ({
    customers: { create: customersCreate, update: vi.fn() },
    checkout: { sessions: { create: sessionsCreate, list: sessionsList } },
    subscriptions: { list: subscriptionsList },
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

  function stubConfiguredEnv() {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", FAKE_STRIPE_WEBHOOK_SECRET);
    vi.stubEnv("STRIPE_PRICE_ID", FAKE_STRIPE_PRICE_ID);
    vi.stubEnv("APP_URL", "http://localhost:3000");
  }

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
    stubConfiguredEnv();
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
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("throws already_active for past_due and does not create a Checkout Session", async () => {
    stubConfiguredEnv();
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    const projection = await import("@/features/billing/projection");
    vi.mocked(projection.getSubscriptionProjection).mockResolvedValue({
      status: "past_due",
      stripeSubscriptionId: "sub_A",
    } as never);

    const { createCheckoutSession } = await import(
      "@/features/billing/checkout"
    );
    await expect(
      createCheckoutSession({ uid: "u1", email: "a@b.co" }),
    ).rejects.toMatchObject({ code: "already_active" });
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("throws already_active when Stripe lists a non-terminal subscription", async () => {
    stubConfiguredEnv();
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    const projection = await import("@/features/billing/projection");
    vi.mocked(projection.getSubscriptionProjection).mockResolvedValue(null);
    subscriptionsList.mockResolvedValue({
      data: [{ id: "sub_incomplete", status: "incomplete" }],
    });

    const { createCheckoutSession } = await import(
      "@/features/billing/checkout"
    );
    await expect(
      createCheckoutSession({ uid: "u1", email: "a@b.co" }),
    ).rejects.toMatchObject({ code: "already_active" });
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("reuses an open Checkout Session instead of creating another", async () => {
    stubConfiguredEnv();
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    const projection = await import("@/features/billing/projection");
    vi.mocked(projection.getSubscriptionProjection).mockResolvedValue(null);
    subscriptionsList.mockResolvedValue({ data: [] });
    sessionsList.mockResolvedValue({
      data: [
        {
          id: "cs_open",
          client_reference_id: "uid_1",
          url: "https://checkout.stripe.com/c/pay/cs_open",
          status: "open",
        },
      ],
    });

    const { createCheckoutSession } = await import(
      "@/features/billing/checkout"
    );
    await expect(
      createCheckoutSession({ uid: "uid_1", email: "a@b.co" }),
    ).resolves.toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_open",
      sessionId: "cs_open",
    });
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("creates a subscription Checkout Session with firebaseUid metadata and integration_identifier", async () => {
    stubConfiguredEnv();
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    const projection = await import("@/features/billing/projection");
    vi.mocked(projection.getSubscriptionProjection).mockResolvedValue(null);
    subscriptionsList.mockResolvedValue({ data: [] });
    sessionsList.mockResolvedValue({ data: [] });
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
        integration_identifier: "prosefield",
      }),
    );
  });

  it("throws stripe_error when Checkout Session has no url", async () => {
    stubConfiguredEnv();
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    const projection = await import("@/features/billing/projection");
    vi.mocked(projection.getSubscriptionProjection).mockResolvedValue(null);
    subscriptionsList.mockResolvedValue({ data: [] });
    sessionsList.mockResolvedValue({ data: [] });
    sessionsCreate.mockResolvedValue({ id: "cs_nourl", url: null });

    const { createCheckoutSession } = await import(
      "@/features/billing/checkout"
    );
    await expect(
      createCheckoutSession({ uid: "u1", email: "a@b.co" }),
    ).rejects.toMatchObject({ code: "stripe_error" });
  });
});
