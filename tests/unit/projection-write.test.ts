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
    const { upsertSubscriptionProjection } = await import(
      "@/features/billing/projection"
    );
    await upsertSubscriptionProjection({
      uid: "uid",
      subscription,
      lastEventId: "evt",
    });
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
    ).resolves.toEqual({ processed: false });
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
    ).resolves.toEqual({ processed: true });
    expect(txSet).toHaveBeenCalledTimes(2);
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
