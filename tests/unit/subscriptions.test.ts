import { afterEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const subscriptionsList = vi.fn();

vi.mock("@/lib/stripe/server", () => ({
  getStripe: () => ({
    subscriptions: { list: subscriptionsList },
  }),
}));

describe("preferBestSubscription / resolveProjectionSubscription", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("prefers an active subscription from the candidate list", async () => {
    const { preferBestSubscription } = await import(
      "@/features/billing/subscriptions"
    );
    const canceled = { id: "sub_A", status: "canceled" } as Stripe.Subscription;
    const active = { id: "sub_B", status: "active" } as Stripe.Subscription;
    expect(preferBestSubscription([canceled, active], canceled)).toBe(active);
  });

  it("falls back to the event subscription when none are active", async () => {
    const { preferBestSubscription } = await import(
      "@/features/billing/subscriptions"
    );
    const pastDue = { id: "sub_A", status: "past_due" } as Stripe.Subscription;
    const unpaid = { id: "sub_B", status: "unpaid" } as Stripe.Subscription;
    expect(preferBestSubscription([unpaid], pastDue)).toBe(pastDue);
    expect(preferBestSubscription([pastDue, unpaid], pastDue)).toBe(pastDue);
  });

  it("lists customer subscriptions and prefers active", async () => {
    const active = {
      id: "sub_B",
      status: "active",
      customer: "cus_1",
    } as Stripe.Subscription;
    const canceled = {
      id: "sub_A",
      status: "canceled",
      customer: "cus_1",
    } as Stripe.Subscription;
    subscriptionsList.mockResolvedValue({ data: [canceled, active] });

    const { resolveProjectionSubscription } = await import(
      "@/features/billing/subscriptions"
    );
    await expect(resolveProjectionSubscription(canceled)).resolves.toBe(active);
    expect(subscriptionsList).toHaveBeenCalledWith({
      customer: "cus_1",
      status: "all",
      limit: 100,
    });
  });

  it("returns fallback when customer is missing or list is empty", async () => {
    const { resolveProjectionSubscription } = await import(
      "@/features/billing/subscriptions"
    );
    const noCustomer = {
      id: "sub_x",
      status: "active",
      customer: null,
    } as unknown as Stripe.Subscription;
    await expect(resolveProjectionSubscription(noCustomer)).resolves.toBe(
      noCustomer,
    );

    const withCustomer = {
      id: "sub_y",
      status: "canceled",
      customer: { id: "cus_empty" },
    } as unknown as Stripe.Subscription;
    subscriptionsList.mockResolvedValue({ data: [] });
    await expect(resolveProjectionSubscription(withCustomer)).resolves.toBe(
      withCustomer,
    );
  });
});
