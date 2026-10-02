import { afterEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

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
  });

  const subscription = {
    id: "sub_1",
    status: "active",
    cancel_at_period_end: false,
    customer: "cus_1",
    metadata: {},
    items: {
      data: [{ price: { id: "price_1" }, current_period_end: 100 }],
    },
  } as unknown as Stripe.Subscription;

  it("upsertSubscriptionProjection writes merge set", async () => {
    get.mockResolvedValue({ exists: false });
    const { upsertSubscriptionProjection } = await import(
      "@/features/billing/projection"
    );
    await expect(
      upsertSubscriptionProjection({
        uid: "uid",
        subscription,
        lastEventId: "evt",
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
    const { processEventWithDedupe } = await import(
      "@/features/billing/projection"
    );
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
    const { processEventWithDedupe } = await import(
      "@/features/billing/projection"
    );
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
          // 1st get: stripeEvents; 2nd get: subscriptions/{uid}
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
    const { processEventWithDedupe } = await import(
      "@/features/billing/projection"
    );
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

    // Dedupe write only — projection for active sub_B must stay.
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
    const { upsertSubscriptionProjection } = await import(
      "@/features/billing/projection"
    );
    const result = await upsertSubscriptionProjection({
      uid: "uid",
      subscription: {
        ...subscription,
        id: "sub_A",
        status: "canceled",
      } as unknown as Stripe.Subscription,
      lastEventId: "evt_stale",
    });
    expect(result).toEqual({ written: false });
    expect(set).not.toHaveBeenCalled();
  });

  it("getSubscriptionProjection returns null when missing", async () => {
    get.mockResolvedValue({ exists: false });
    const { getSubscriptionProjection } = await import(
      "@/features/billing/projection"
    );
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
