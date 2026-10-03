import { afterEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const customersCreate = vi.fn();
const customersUpdate = vi.fn();
const customersRetrieve = vi.fn();
const runTransaction = vi.fn();
const stripeCustomersGet = vi.fn();

vi.mock("@/lib/stripe/server", () => ({
  getStripe: () => ({
    customers: {
      create: customersCreate,
      update: customersUpdate,
      retrieve: customersRetrieve,
    },
  }),
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: () => ({
    collection: (name: string) => {
      if (name === "users") {
        return {
          doc: () => ({ path: "users/uid" }),
        };
      }
      if (name === "stripeCustomers") {
        return {
          doc: () => ({
            get: stripeCustomersGet,
            path: "stripeCustomers/cus",
          }),
        };
      }
      return { doc: () => ({}) };
    },
    runTransaction,
  }),
}));

describe("customers", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns existing stripeCustomerId and skips update when email matches", async () => {
    runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: async () => ({
          exists: true,
          data: () => ({ stripeCustomerId: "cus_existing" }),
        }),
        set: vi.fn(),
      };
      return fn(tx);
    });
    customersRetrieve.mockResolvedValue({
      id: "cus_existing",
      email: "a@b.co",
      deleted: false,
    });
    const { getOrCreateStripeCustomer } = await import(
      "@/features/billing/customers"
    );
    await expect(
      getOrCreateStripeCustomer({ uid: "uid", email: "a@b.co" }),
    ).resolves.toBe("cus_existing");
    expect(customersCreate).not.toHaveBeenCalled();
    expect(customersUpdate).not.toHaveBeenCalled();
  });

  it("updates email on existing customer only when it differs", async () => {
    runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: async () => ({
          exists: true,
          data: () => ({ stripeCustomerId: "cus_existing" }),
        }),
        set: vi.fn(),
      };
      return fn(tx);
    });
    customersRetrieve.mockResolvedValue({
      id: "cus_existing",
      email: "old@b.co",
      deleted: false,
    });
    customersUpdate.mockResolvedValue({ id: "cus_existing" });
    const { getOrCreateStripeCustomer } = await import(
      "@/features/billing/customers"
    );
    await expect(
      getOrCreateStripeCustomer({ uid: "uid", email: "new@b.co" }),
    ).resolves.toBe("cus_existing");
    expect(customersUpdate).toHaveBeenCalledWith("cus_existing", {
      email: "new@b.co",
    });
  });

  it("creates a customer with idempotency key without email, then updates email", async () => {
    customersCreate.mockResolvedValue({ id: "cus_new" });
    customersUpdate.mockResolvedValue({ id: "cus_new" });
    const set = vi.fn();
    runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: async () => ({
          exists: true,
          data: () => ({ stripeCustomerId: null }),
        }),
        set,
      };
      return fn(tx);
    });
    const { getOrCreateStripeCustomer } = await import(
      "@/features/billing/customers"
    );
    await expect(
      getOrCreateStripeCustomer({ uid: "uid_1", email: "a@b.co" }),
    ).resolves.toBe("cus_new");
    expect(customersCreate).toHaveBeenCalledWith(
      { metadata: { firebaseUid: "uid_1" } },
      { idempotencyKey: "customer-uid_1" },
    );
    expect(customersUpdate).toHaveBeenCalledWith("cus_new", {
      email: "a@b.co",
    });
    expect(customersRetrieve).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalled();
  });

  it("creates the user doc when missing during customer creation", async () => {
    customersCreate.mockResolvedValue({ id: "cus_brand" });
    customersUpdate.mockResolvedValue({ id: "cus_brand" });
    const set = vi.fn();
    runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: async () => ({ exists: false, data: () => undefined }),
        set,
      };
      return fn(tx);
    });
    const { getOrCreateStripeCustomer } = await import(
      "@/features/billing/customers"
    );
    await expect(
      getOrCreateStripeCustomer({ uid: "uid_2", email: "new@b.co" }),
    ).resolves.toBe("cus_brand");
    expect(set).toHaveBeenCalled();
  });

  it("still returns customer id when email update fails with a Stripe code", async () => {
    customersCreate.mockResolvedValue({ id: "cus_ok" });
    customersUpdate.mockRejectedValue({ code: "rate_limit", message: "slow" });
    runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: async () => ({ exists: false, data: () => undefined }),
        set: vi.fn(),
      };
      return fn(tx);
    });
    const { getOrCreateStripeCustomer } = await import(
      "@/features/billing/customers"
    );
    await expect(
      getOrCreateStripeCustomer({ uid: "uid_3", email: "x@y.co" }),
    ).resolves.toBe("cus_ok");
  });

  it("looks up uid by stripe customer id", async () => {
    stripeCustomersGet.mockResolvedValue({
      exists: true,
      data: () => ({ uid: "uid_lookup" }),
    });
    const { lookupUidByStripeCustomerId } = await import(
      "@/features/billing/customers"
    );
    await expect(lookupUidByStripeCustomerId("cus_x")).resolves.toBe(
      "uid_lookup",
    );

    stripeCustomersGet.mockResolvedValue({ exists: false });
    await expect(lookupUidByStripeCustomerId("cus_missing")).resolves.toBeNull();
  });
});

describe("webhook subscription id extraction paths", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("handles checkout.session and invoice parent.subscription_details shapes", async () => {
    const retrieve = vi.fn(async () => ({
      id: "sub_from_session",
      metadata: { firebaseUid: "uid_s" },
      customer: "cus_s",
      status: "active",
      cancel_at_period_end: false,
      items: { data: [{ price: { id: "price_1" }, current_period_end: 1 }] },
    }));
    const list = vi.fn(async () => ({
      data: [
        {
          id: "sub_from_session",
          metadata: { firebaseUid: "uid_s" },
          customer: "cus_s",
          status: "active",
          cancel_at_period_end: false,
          items: {
            data: [{ price: { id: "price_1" }, current_period_end: 1 }],
          },
        },
      ],
    }));
    vi.doMock("@/lib/stripe/server", () => ({
      getStripe: () => ({
        webhooks: { constructEvent: vi.fn() },
        subscriptions: { retrieve, list },
      }),
    }));
    vi.doMock("@/features/billing/projection", () => ({
      processEventWithDedupe: vi.fn(async () => ({ processed: true })),
    }));
    vi.doMock("@/features/billing/customers", () => ({
      lookupUidByStripeCustomerId: vi.fn(async () => null),
    }));
    vi.doMock("@/lib/env", async () => {
      const actual = await vi.importActual<typeof import("@/lib/env")>(
        "@/lib/env",
      );
      const fixtures = await import("../fixtures/stripe");
      return {
        ...actual,
        getEnv: () => ({
          ...actual.localDevDefaults,
          STRIPE_SECRET_KEY: fixtures.FAKE_STRIPE_SECRET_KEY,
          STRIPE_WEBHOOK_SECRET: fixtures.FAKE_STRIPE_WEBHOOK_SECRET,
          STRIPE_PRICE_ID: fixtures.FAKE_STRIPE_PRICE_ID,
          FEATURE_CUSTOMER_PORTAL: false,
        }),
      };
    });

    const { handleStripeEvent } = await import("@/features/billing/webhook");
    const sessionResult = await handleStripeEvent({
      id: "evt_cs",
      type: "checkout.session.completed",
      created: 1,
      data: {
        object: {
          object: "checkout.session",
          id: "cs_1",
          client_reference_id: "uid_s",
          subscription: "sub_from_session",
        },
      },
    } as unknown as Stripe.Event);
    expect(sessionResult.processed).toBe(true);

    const invoiceResult = await handleStripeEvent({
      id: "evt_inv",
      type: "invoice.paid",
      created: 2,
      data: {
        object: {
          object: "invoice",
          parent: {
            subscription_details: { subscription: "sub_from_session" },
          },
        },
      },
    } as unknown as Stripe.Event);
    expect(invoiceResult.processed).toBe(true);

    const noSub = await handleStripeEvent({
      id: "evt_nosub",
      type: "invoice.payment_failed",
      created: 3,
      data: { object: { object: "invoice" } },
    } as unknown as Stripe.Event);
    expect(noSub).toMatchObject({
      handled: true,
      processed: false,
      reason: "no_subscription_id",
    });
  });
});
