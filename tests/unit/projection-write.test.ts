import { afterEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import {
  FAKE_STRIPE_PRICE_ID,
  FAKE_STRIPE_SECRET_KEY,
  FAKE_STRIPE_WEBHOOK_SECRET,
} from "../fixtures/stripe";

const set = vi.fn();
const runTransaction = vi.fn();
const get = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: () => ({
    collection: () => ({
      doc: () => ({ set, get }),
    }),
    runTransaction,
  }),
}));

describe("projection write helpers", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function loadWithPrice(priceId = FAKE_STRIPE_PRICE_ID) {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_STRIPE_SECRET_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", FAKE_STRIPE_WEBHOOK_SECRET);
    vi.stubEnv("STRIPE_PRICE_ID", priceId);
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    return import("@/features/billing/projection");
  }

  const subscription = {
    id: "sub_1",
    status: "active",
    cancel_at_period_end: false,
    customer: "cus_1",
    metadata: {},
    items: {
      data: [{ price: { id: FAKE_STRIPE_PRICE_ID }, current_period_end: 100 }],
    },
  } as unknown as Stripe.Subscription;

  it("upsertSubscriptionProjection writes merge set", async () => {
    get.mockResolvedValue({ exists: false });
    const { upsertSubscriptionProjection } = await loadWithPrice();
    await expect(
      upsertSubscriptionProjection({
        uid: "uid",
        subscription,
        lastEventId: "evt",
        eventCreated: 10,
      }),
    ).resolves.toEqual({ written: true });
    expect(set).toHaveBeenCalledWith(expect.any(Object), { merge: true });
  });

  it("processEventWithDedupe no-ops when event exists", async () => {
    runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: async () => ({ exists: true }),
        set: vi.fn(),
      };
      return fn(tx);
    });
    const { processEventWithDedupe } = await loadWithPrice();
    await expect(
      processEventWithDedupe({
        eventId: "evt_dup",
        eventType: "customer.subscription.updated",
        eventCreated: 1,
        uid: "uid",
        subscription,
      }),
    ).resolves.toEqual({ processed: false, projected: false });
  });

  it("processEventWithDedupe writes event + projection", async () => {
    const txSet = vi.fn();
    runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: async () => ({ exists: false }),
        set: txSet,
      };
      return fn(tx);
    });
    const { processEventWithDedupe } = await loadWithPrice();
    await expect(
      processEventWithDedupe({
        eventId: "evt_new",
        eventType: "customer.subscription.updated",
        eventCreated: 1,
        uid: "uid",
        subscription,
      }),
    ).resolves.toEqual({ processed: true, projected: true });
    expect(txSet).toHaveBeenCalledTimes(2);
  });

  it("processEventWithDedupe keeps active sub_B when late canceled sub_A arrives", async () => {
    const txSet = vi.fn();
    let getCalls = 0;
    runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: async () => {
          getCalls += 1;
          if (getCalls === 1) {
            return { exists: false };
          }
          return {
            exists: true,
            data: () => ({
              stripeSubscriptionId: "sub_B",
              status: "active",
            }),
          };
        },
        set: txSet,
      };
      return fn(tx);
    });
    const { processEventWithDedupe } = await loadWithPrice();
    const canceledA = {
      ...subscription,
      id: "sub_A",
      status: "canceled",
    } as unknown as Stripe.Subscription;

    await expect(
      processEventWithDedupe({
        eventId: "evt_late_a",
        eventType: "customer.subscription.deleted",
        eventCreated: 99,
        uid: "uid",
        subscription: canceledA,
      }),
    ).resolves.toEqual({ processed: true, projected: false });

    expect(txSet).toHaveBeenCalledTimes(1);
  });

  it("upsertSubscriptionProjection skips overwrite of active other subscription", async () => {
    get.mockResolvedValue({
      exists: true,
      data: () => ({
        stripeSubscriptionId: "sub_B",
        status: "active",
      }),
    });
    const { upsertSubscriptionProjection } = await loadWithPrice();
    const result = await upsertSubscriptionProjection({
      uid: "uid",
      subscription: {
        ...subscription,
        id: "sub_A",
        status: "canceled",
      } as unknown as Stripe.Subscription,
      lastEventId: "evt_stale",
    });
    expect(result).toEqual({ written: false, reason: "guarded" });
    expect(set).not.toHaveBeenCalled();
  });

  it("skips projection when stripePriceId does not match STRIPE_PRICE_ID", async () => {
    get.mockResolvedValue({ exists: false });
    const { upsertSubscriptionProjection, processEventWithDedupe } =
      await loadWithPrice();
    const wrongPrice = {
      ...subscription,
      items: {
        data: [{ price: { id: "price_other" }, current_period_end: 100 }],
      },
    } as unknown as Stripe.Subscription;

    await expect(
      upsertSubscriptionProjection({
        uid: "uid",
        subscription: wrongPrice,
        lastEventId: "evt",
      }),
    ).resolves.toEqual({ written: false, reason: "price_mismatch" });
    expect(set).not.toHaveBeenCalled();

    const txSet = vi.fn();
    runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: async () => ({ exists: false }),
        set: txSet,
      };
      return fn(tx);
    });
    await expect(
      processEventWithDedupe({
        eventId: "evt_wrong_price",
        eventType: "customer.subscription.updated",
        eventCreated: 1,
        uid: "uid",
        subscription: wrongPrice,
      }),
    ).resolves.toEqual({ processed: true, projected: false });
    expect(txSet).toHaveBeenCalledTimes(1);
  });

  it("skips stale concurrent event when lastStripeEventCreated is newer", async () => {
    get.mockResolvedValue({
      exists: true,
      data: () => ({
        stripeSubscriptionId: "sub_1",
        status: "active",
        lastStripeEventCreated: 200,
      }),
    });
    const { upsertSubscriptionProjection, shouldAcceptStripeEventCreated } =
      await loadWithPrice();
    expect(shouldAcceptStripeEventCreated(200, 100)).toBe(false);
    expect(shouldAcceptStripeEventCreated(null, 100)).toBe(true);
    expect(shouldAcceptStripeEventCreated(100, null)).toBe(true);

    await expect(
      upsertSubscriptionProjection({
        uid: "uid",
        subscription,
        lastEventId: "evt_old",
        eventCreated: 100,
      }),
    ).resolves.toEqual({ written: false, reason: "stale_event" });
    expect(set).not.toHaveBeenCalled();
  });

  it("getSubscriptionProjection returns null when missing", async () => {
    get.mockResolvedValue({ exists: false });
    const { getSubscriptionProjection } = await loadWithPrice();
    await expect(getSubscriptionProjection("uid")).resolves.toBeNull();
    get.mockResolvedValue({
      exists: true,
      data: () => ({ status: "active" }),
    });
    await expect(getSubscriptionProjection("uid")).resolves.toMatchObject({
      status: "active",
    });
  });
});
