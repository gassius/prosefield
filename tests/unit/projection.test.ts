import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { projectionFromSubscription } from "@/features/billing/projection";

function fakeSubscription(
  overrides: Partial<Stripe.Subscription> & {
    items?: { data: Array<{ current_period_end?: number; price?: { id: string } }> };
  } = {},
): Stripe.Subscription {
  return {
    id: "sub_test",
    object: "subscription",
    status: "active",
    cancel_at_period_end: false,
    customer: "cus_test",
    metadata: { firebaseUid: "uid_1" },
    items: {
      object: "list",
      data: [
        {
          id: "si_1",
          object: "subscription_item",
          current_period_end: 1_800_000_000,
          current_period_start: 1_700_000_000,
          price: { id: "price_test" },
        },
      ],
      has_more: false,
      url: "",
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

describe("projectionFromSubscription", () => {
  it("maps canonical Subscription fields including item period end", () => {
    const projection = projectionFromSubscription(
      fakeSubscription({ cancel_at_period_end: true }),
      "evt_1",
    );
    expect(projection).toMatchObject({
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
      stripePriceId: "price_test",
      status: "active",
      cancelAtPeriodEnd: true,
      lastEventId: "evt_1",
    });
    expect(projection.currentPeriodEnd).toEqual(new Date(1_800_000_000 * 1000));
  });

  it("handles expanded customer objects and missing items", () => {
    const projection = projectionFromSubscription(
      fakeSubscription({
        customer: { id: "cus_expanded" } as Stripe.Customer,
        items: { object: "list", data: [], has_more: false, url: "" },
      }),
      null,
    );
    expect(projection.stripeCustomerId).toBe("cus_expanded");
    expect(projection.stripePriceId).toBe("");
    expect(projection.currentPeriodEnd).toBeNull();
    expect(projection.lastEventId).toBeNull();
  });
});
