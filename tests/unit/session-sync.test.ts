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
  getSubscriptionProjection: vi.fn(async () => null),
  upsertSubscriptionProjection,
}));

describe("session-sync", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("rejects uid mismatch and projects when session is complete", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", FAKE_STRIPE_WEBHOOK_SECRET);
    vi.stubEnv("STRIPE_PRICE_ID", FAKE_STRIPE_PRICE_ID);
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();

    const { syncFromCheckoutSession, isValidCheckoutSessionId } = await import(
      "@/features/billing/session-sync"
    );
    expect(isValidCheckoutSessionId("cs_test_abc")).toBe(true);
    expect(isValidCheckoutSessionId("cs_live_abc")).toBe(true);
    expect(isValidCheckoutSessionId("not_a_session")).toBe(false);
    expect(
      await syncFromCheckoutSession({ uid: "uid_1", sessionId: "evil" }),
    ).toEqual({ synced: false, reason: "invalid_session_id" });

    retrieveSession.mockResolvedValue({
      client_reference_id: "other",
      status: "complete",
      subscription: "sub_1",
    });
    expect(
      await syncFromCheckoutSession({
        uid: "uid_1",
        sessionId: "cs_test_1",
      }),
    ).toEqual({ synced: false, reason: "uid_mismatch" });

    const sub = {
      id: "sub_1",
      status: "active",
      customer: "cus_1",
      cancel_at_period_end: false,
      items: { data: [{ price: { id: "price_1" }, current_period_end: 1 }] },
    };
    retrieveSession.mockResolvedValue({
      client_reference_id: "uid_1",
      status: "complete",
      payment_status: "paid",
      subscription: "sub_1",
    });
    retrieveSubscription.mockResolvedValue(sub);
    listSubscriptions.mockResolvedValue({ data: [sub] });

    expect(
      await syncFromCheckoutSession({
        uid: "uid_1",
        sessionId: "cs_test_1",
      }),
    ).toEqual({ synced: true });
    expect(upsertSubscriptionProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "uid_1",
        lastEventId: "session_sync:cs_test_1",
      }),
    );
  });

  it("resolveBillingStatusView maps projection to views", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", PLACEHOLDER_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_PRICE_ID", PLACEHOLDER_STRIPE_PRICE_ID);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", PLACEHOLDER_STRIPE_WEBHOOK_SECRET);
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    const projection = await import("@/features/billing/projection");

    const { resolveBillingStatusView } = await import(
      "@/features/billing/session-sync"
    );

    vi.mocked(projection.getSubscriptionProjection).mockResolvedValue(null);
    expect(await resolveBillingStatusView({ uid: "u" })).toEqual({
      view: "pending",
    });

    vi.mocked(projection.getSubscriptionProjection).mockResolvedValue({
      status: "active",
    } as never);
    expect(await resolveBillingStatusView({ uid: "u" })).toEqual({
      view: "active",
    });

    vi.mocked(projection.getSubscriptionProjection).mockResolvedValue({
      status: "unpaid",
    } as never);
    expect(await resolveBillingStatusView({ uid: "u" })).toEqual({
      view: "failed",
    });
  });
});
