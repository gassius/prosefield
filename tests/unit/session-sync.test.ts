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

  it("accepts only cs_test_ and cs_live_ session ids", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", FAKE_STRIPE_WEBHOOK_SECRET);
    vi.stubEnv("STRIPE_PRICE_ID", FAKE_STRIPE_PRICE_ID);
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();

    const { isValidCheckoutSessionId, syncFromCheckoutSession } = await import(
      "@/features/billing/session-sync"
    );
    expect(isValidCheckoutSessionId("cs_test_abc")).toBe(true);
    expect(isValidCheckoutSessionId("cs_live_abc")).toBe(true);
    // Weakening to /^cs_/ must fail these:
    expect(isValidCheckoutSessionId("cs_foo")).toBe(false);
    expect(isValidCheckoutSessionId("cs_prod_1")).toBe(false);
    expect(isValidCheckoutSessionId("not_a_session")).toBe(false);

    for (const bad of ["cs_foo", "cs_prod_1", "evil"]) {
      expect(
        await syncFromCheckoutSession({ uid: "uid_1", sessionId: bad }),
      ).toEqual({ synced: false, reason: "invalid_session_id" });
    }
    expect(retrieveSession).not.toHaveBeenCalled();
  });

  it("rejects uid mismatch and projects when session is complete", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", FAKE_STRIPE_WEBHOOK_SECRET);
    vi.stubEnv("STRIPE_PRICE_ID", FAKE_STRIPE_PRICE_ID);
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();

    const { syncFromCheckoutSession } = await import(
      "@/features/billing/session-sync"
    );

    retrieveSession.mockResolvedValue({
      client_reference_id: "other",
      status: "complete",
      subscription: "sub_1",
      created: 1_700_000_000,
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
      created: 1_700_000_123,
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
        // Stripe clock from session.created — removing this stamp must fail.
        eventCreated: 1_700_000_123,
      }),
    );
  });

  it("session-sync prefers an active sibling over the retrieved canceled sub", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", FAKE_STRIPE_WEBHOOK_SECRET);
    vi.stubEnv("STRIPE_PRICE_ID", FAKE_STRIPE_PRICE_ID);
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();

    const canceled = {
      id: "sub_A",
      status: "canceled",
      customer: "cus_1",
      cancel_at_period_end: false,
      items: { data: [{ price: { id: "price_1" }, current_period_end: 1 }] },
    };
    const active = {
      id: "sub_B",
      status: "active",
      customer: "cus_1",
      cancel_at_period_end: false,
      items: { data: [{ price: { id: "price_1" }, current_period_end: 1 }] },
    };
    retrieveSession.mockResolvedValue({
      client_reference_id: "uid_1",
      status: "complete",
      payment_status: "paid",
      subscription: "sub_A",
      created: 1_700_000_200,
    });
    retrieveSubscription.mockResolvedValue(canceled);
    listSubscriptions.mockResolvedValue({ data: [canceled, active] });

    const { syncFromCheckoutSession } = await import(
      "@/features/billing/session-sync"
    );
    await expect(
      syncFromCheckoutSession({ uid: "uid_1", sessionId: "cs_test_sib" }),
    ).resolves.toEqual({ synced: true });
    expect(upsertSubscriptionProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription: expect.objectContaining({ id: "sub_B", status: "active" }),
        eventCreated: 1_700_000_200,
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
