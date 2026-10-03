import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FAKE_STRIPE_PRICE_ID,
  FAKE_STRIPE_SECRET_KEY,
  FAKE_STRIPE_WEBHOOK_SECRET,
  PLACEHOLDER_STRIPE_PRICE_ID,
  PLACEHOLDER_STRIPE_SECRET_KEY,
  PLACEHOLDER_STRIPE_WEBHOOK_SECRET,
} from "../fixtures/stripe";


const retrieveSession = vi.fn();
const retrieveSubscription = vi.fn();
const listSubscriptions = vi.fn();
const upsertSubscriptionProjection = vi.fn();
const getSubscriptionProjection = vi.fn();

vi.mock("@/lib/stripe/server", () => ({
  getStripe: () => ({
    checkout: { sessions: { retrieve: retrieveSession } },
    subscriptions: {
      retrieve: retrieveSubscription,
      list: listSubscriptions,
    },
  }),
}));

vi.mock("@/features/billing/projection", () => ({
  getSubscriptionProjection,
  upsertSubscriptionProjection,
}));

describe("session-sync coverage", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function loadConfigured() {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", FAKE_STRIPE_WEBHOOK_SECRET);
    vi.stubEnv("STRIPE_PRICE_ID", FAKE_STRIPE_PRICE_ID);
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    return import("@/features/billing/session-sync");
  }

  it("covers unpaid, expired, not_complete, and missing subscription", async () => {
    const { syncFromCheckoutSession } = await loadConfigured();

    retrieveSession.mockResolvedValue({
      client_reference_id: "uid_1",
      status: "expired",
    });
    expect(
      await syncFromCheckoutSession({
        uid: "uid_1",
        sessionId: "cs_test_x",
      }),
    ).toEqual({ synced: false, reason: "expired" });

    retrieveSession.mockResolvedValue({
      client_reference_id: "uid_1",
      status: "open",
      payment_status: "unpaid",
    });
    expect(
      await syncFromCheckoutSession({
        uid: "uid_1",
        sessionId: "cs_test_x",
      }),
    ).toEqual({ synced: false, reason: "unpaid" });

    retrieveSession.mockResolvedValue({
      client_reference_id: "uid_1",
      status: "open",
      payment_status: "paid",
    });
    expect(
      await syncFromCheckoutSession({
        uid: "uid_1",
        sessionId: "cs_test_x",
      }),
    ).toEqual({ synced: false, reason: "not_complete" });

    retrieveSession.mockResolvedValue({
      client_reference_id: "uid_1",
      status: "complete",
      payment_status: "paid",
      subscription: null,
    });
    expect(
      await syncFromCheckoutSession({
        uid: "uid_1",
        sessionId: "cs_test_x",
      }),
    ).toEqual({ synced: false, reason: "no_subscription" });

    const sub = {
      id: "sub_obj",
      status: "active",
      cancel_at_period_end: false,
      customer: "cus_1",
      items: { data: [{ price: { id: "price_1" }, current_period_end: 1 }] },
    };
    retrieveSession.mockResolvedValue({
      client_reference_id: "uid_1",
      status: "complete",
      payment_status: "paid",
      subscription: { id: "sub_obj" },
    });
    retrieveSubscription.mockResolvedValue(sub);
    listSubscriptions.mockResolvedValue({ data: [sub] });
    expect(
      await syncFromCheckoutSession({
        uid: "uid_1",
        sessionId: "cs_test_x",
      }),
    ).toEqual({ synced: true });
  });

  it("syncFromCheckoutSession returns not_configured for placeholders", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", PLACEHOLDER_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_PRICE_ID", PLACEHOLDER_STRIPE_PRICE_ID);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", PLACEHOLDER_STRIPE_WEBHOOK_SECRET);
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    const { syncFromCheckoutSession } = await import(
      "@/features/billing/session-sync"
    );
    expect(
      await syncFromCheckoutSession({ uid: "uid_1", sessionId: "cs" }),
    ).toEqual({ synced: false, reason: "not_configured" });
  });

  it("resolveBillingStatusView handles not_configured, sync failures, and expired", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", PLACEHOLDER_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_PRICE_ID", PLACEHOLDER_STRIPE_PRICE_ID);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", PLACEHOLDER_STRIPE_WEBHOOK_SECRET);
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    const sync = await import("@/features/billing/session-sync");

    const notConfigured = await sync.resolveBillingStatusView({
      uid: "u",
      sessionId: "cs_test_1",
    });
    expect(notConfigured.view).toBe("not_configured");

    const configured = await loadConfigured();
    retrieveSession.mockResolvedValue({
      client_reference_id: "u",
      status: "expired",
    });
    getSubscriptionProjection.mockResolvedValue(null);
    expect(
      await configured.resolveBillingStatusView({
        uid: "u",
        sessionId: "cs_test_x",
      }),
    ).toEqual({ view: "failed" });

    retrieveSession.mockRejectedValue(new Error("stripe down"));
    getSubscriptionProjection.mockResolvedValue(null);
    expect(
      await configured.resolveBillingStatusView({
        uid: "u",
        sessionId: "cs_test_x",
      }),
    ).toEqual({ view: "pending" });

    retrieveSession.mockResolvedValue({
      client_reference_id: "other",
      status: "complete",
      subscription: "sub_1",
    });
    expect(
      await configured.resolveBillingStatusView({
        uid: "u",
        sessionId: "cs_test_x",
      }),
    ).toEqual({ view: "failed" });

    expect(
      await configured.resolveBillingStatusView({
        uid: "u",
        sessionId: "not-a-cs-id",
      }),
    ).toEqual({ view: "failed" });
  });
});
