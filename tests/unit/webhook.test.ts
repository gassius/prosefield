import { afterEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import {
  FAKE_STRIPE_WEBHOOK_SECRET,
} from "../fixtures/stripe";


const constructEvent = vi.fn();
const retrieveSubscription = vi.fn();
const processEventWithDedupe = vi.fn(async () => ({ processed: true }));

vi.mock("@/lib/stripe/server", () => ({
  getStripe: () => ({
    webhooks: { constructEvent },
    subscriptions: { retrieve: retrieveSubscription },
  }),
}));

vi.mock("@/lib/env", async () => {
  const actual = await vi.importActual<typeof import("@/lib/env")>("@/lib/env");
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

vi.mock("@/features/billing/customers", () => ({
  lookupUidByStripeCustomerId: vi.fn(async (id: string) =>
    id === "cus_known" ? "uid_from_lookup" : null,
  ),
}));

vi.mock("@/features/billing/projection", () => ({
  processEventWithDedupe,
}));

describe("webhook helpers", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("constructStripeEvent verifies signature via Stripe SDK", async () => {
    const event = { id: "evt_1", type: "customer.subscription.updated" };
    constructEvent.mockReturnValue(event);
    const { constructStripeEvent } = await import("@/features/billing/webhook");
    expect(constructStripeEvent("raw", "sig_header")).toBe(event);
    expect(constructEvent).toHaveBeenCalledWith(
      "raw",
      "sig_header",
      FAKE_STRIPE_WEBHOOK_SECRET,
    );
    expect(() => constructStripeEvent("raw", null)).toThrow(/signature/i);
  });

  it("resolves uid from subscription metadata first", async () => {
    const { resolveFirebaseUid } = await import("@/features/billing/webhook");
    const uid = await resolveFirebaseUid({
      subscription: {
        metadata: { firebaseUid: "uid_meta" },
        customer: "cus_known",
      } as unknown as Stripe.Subscription,
      session: {
        client_reference_id: "uid_session",
      } as unknown as Stripe.Checkout.Session,
    });
    expect(uid).toBe("uid_meta");
  });

  it("falls back to session client_reference_id then stripeCustomers lookup", async () => {
    const { resolveFirebaseUid } = await import("@/features/billing/webhook");
    expect(
      await resolveFirebaseUid({
        session: {
          client_reference_id: "uid_session",
        } as unknown as Stripe.Checkout.Session,
      }),
    ).toBe("uid_session");

    expect(
      await resolveFirebaseUid({
        customerId: "cus_known",
      }),
    ).toBe("uid_from_lookup");

    expect(await resolveFirebaseUid({})).toBeNull();
  });

  it("ignores unknown event types and projects handled subscription events", async () => {
    const { handleStripeEvent } = await import("@/features/billing/webhook");

    const ignored = await handleStripeEvent({
      id: "evt_ignored",
      type: "charge.succeeded",
      created: 1,
      data: { object: {} },
    } as unknown as Stripe.Event);
    expect(ignored).toEqual({
      handled: false,
      processed: false,
      reason: "ignored_type",
    });

    retrieveSubscription.mockResolvedValue({
      id: "sub_1",
      metadata: { firebaseUid: "uid_1" },
      customer: "cus_1",
      status: "active",
      cancel_at_period_end: false,
      items: { data: [{ price: { id: "price_1" }, current_period_end: 100 }] },
    });

    const handled = await handleStripeEvent({
      id: "evt_sub",
      type: "customer.subscription.updated",
      created: 2,
      data: {
        object: { object: "subscription", id: "sub_1" },
      },
    } as unknown as Stripe.Event);

    expect(retrieveSubscription).toHaveBeenCalledWith("sub_1");
    expect(processEventWithDedupe).toHaveBeenCalled();
    expect(handled.handled).toBe(true);
    expect(handled.processed).toBe(true);
  });

  it("returns uid_unresolved when firebase uid cannot be resolved", async () => {
    const { handleStripeEvent } = await import("@/features/billing/webhook");
    retrieveSubscription.mockResolvedValue({
      id: "sub_orphan",
      metadata: {},
      customer: "cus_unknown",
      status: "active",
      cancel_at_period_end: false,
      items: { data: [{ price: { id: "price_1" }, current_period_end: 100 }] },
    });

    const result = await handleStripeEvent({
      id: "evt_orphan",
      type: "customer.subscription.updated",
      created: 3,
      data: {
        object: { object: "subscription", id: "sub_orphan" },
      },
    } as unknown as Stripe.Event);

    expect(result).toEqual({
      handled: true,
      processed: false,
      reason: "uid_unresolved",
    });
    expect(processEventWithDedupe).not.toHaveBeenCalled();
  });

  it("returns no_subscription_id for invoice without subscription", async () => {
    const { handleStripeEvent } = await import("@/features/billing/webhook");
    const result = await handleStripeEvent({
      id: "evt_inv",
      type: "invoice.paid",
      created: 4,
      data: {
        object: { object: "invoice", id: "in_1" },
      },
    } as unknown as Stripe.Event);
    expect(result).toEqual({
      handled: true,
      processed: false,
      reason: "no_subscription_id",
    });
    expect(retrieveSubscription).not.toHaveBeenCalled();
  });

  it("retrieves subscription from checkout.session.completed", async () => {
    const { handleStripeEvent } = await import("@/features/billing/webhook");
    retrieveSubscription.mockResolvedValue({
      id: "sub_cs",
      metadata: { firebaseUid: "uid_cs" },
      customer: "cus_1",
      status: "active",
      cancel_at_period_end: false,
      items: { data: [{ price: { id: "price_1" }, current_period_end: 100 }] },
    });

    const result = await handleStripeEvent({
      id: "evt_cs",
      type: "checkout.session.completed",
      created: 5,
      data: {
        object: {
          object: "checkout.session",
          id: "cs_1",
          client_reference_id: "uid_cs",
          subscription: "sub_cs",
        },
      },
    } as unknown as Stripe.Event);

    expect(retrieveSubscription).toHaveBeenCalledWith("sub_cs");
    expect(processEventWithDedupe).toHaveBeenCalled();
    expect(result.handled).toBe(true);
    expect(result.processed).toBe(true);
  });

  it("resolves subscription id from expanded objects and invoice string", async () => {
    const { handleStripeEvent } = await import("@/features/billing/webhook");
    retrieveSubscription.mockResolvedValue({
      id: "sub_exp",
      metadata: { firebaseUid: "uid_exp" },
      customer: { id: "cus_obj" },
      status: "active",
      cancel_at_period_end: false,
      items: { data: [{ price: { id: "price_1" }, current_period_end: 100 }] },
    });

    await handleStripeEvent({
      id: "evt_cs_obj",
      type: "checkout.session.completed",
      created: 6,
      data: {
        object: {
          object: "checkout.session",
          id: "cs_2",
          client_reference_id: "uid_exp",
          subscription: { id: "sub_exp" },
          customer: { id: "cus_obj" },
        },
      },
    } as unknown as Stripe.Event);
    expect(retrieveSubscription).toHaveBeenCalledWith("sub_exp");

    retrieveSubscription.mockResolvedValue({
      id: "sub_inv",
      metadata: { firebaseUid: "uid_inv" },
      customer: "cus_1",
      status: "active",
      cancel_at_period_end: false,
      items: { data: [{ price: { id: "price_1" }, current_period_end: 100 }] },
    });
    await handleStripeEvent({
      id: "evt_inv_ok",
      type: "invoice.paid",
      created: 7,
      data: {
        object: {
          object: "invoice",
          id: "in_2",
          subscription: "sub_inv",
        },
      },
    } as unknown as Stripe.Event);
    expect(retrieveSubscription).toHaveBeenCalledWith("sub_inv");
    expect(processEventWithDedupe).toHaveBeenCalled();
  });

  it("falls back to customer object on subscription for uid lookup", async () => {
    const { resolveFirebaseUid } = await import("@/features/billing/webhook");
    expect(
      await resolveFirebaseUid({
        subscription: {
          metadata: {},
          customer: { id: "cus_known" },
        } as unknown as Stripe.Subscription,
      }),
    ).toBe("uid_from_lookup");

    expect(
      await resolveFirebaseUid({
        session: {
          client_reference_id: null,
          customer: { id: "cus_known" },
        } as unknown as Stripe.Checkout.Session,
      }),
    ).toBe("uid_from_lookup");

    expect(
      await resolveFirebaseUid({
        session: {
          client_reference_id: null,
          customer: "cus_known",
        } as unknown as Stripe.Checkout.Session,
      }),
    ).toBe("uid_from_lookup");
  });
});
