import { describe, expect, it } from "vitest";
import {
  isEntitledStatus,
  isFailedBillingStatus,
  isNonTerminalSubscriptionStatus,
  NON_TERMINAL_SUBSCRIPTION_STATUSES,
  shouldReplaceSubscriptionProjection,
} from "@/features/billing/entitlement";

describe("entitlement", () => {
  it("grants access only for active", () => {
    expect(isEntitledStatus("active")).toBe(true);
    for (const status of [
      "canceled",
      "incomplete",
      "incomplete_expired",
      "past_due",
      "paused",
      "trialing",
      "unpaid",
      null,
      undefined,
      "",
    ]) {
      expect(isEntitledStatus(status)).toBe(false);
    }
  });

  it("documents non-terminal statuses that block checkout", () => {
    expect([...NON_TERMINAL_SUBSCRIPTION_STATUSES]).toEqual([
      "active",
      "trialing",
      "past_due",
      "unpaid",
      "incomplete",
    ]);
    for (const status of NON_TERMINAL_SUBSCRIPTION_STATUSES) {
      expect(isNonTerminalSubscriptionStatus(status)).toBe(true);
    }
    expect(isNonTerminalSubscriptionStatus("canceled")).toBe(false);
    expect(isNonTerminalSubscriptionStatus("incomplete_expired")).toBe(false);
    expect(isNonTerminalSubscriptionStatus("paused")).toBe(false);
    expect(isNonTerminalSubscriptionStatus(null)).toBe(false);
  });

  it("marks terminal failure statuses for the billing status page", () => {
    expect(isFailedBillingStatus("incomplete_expired")).toBe(true);
    expect(isFailedBillingStatus("unpaid")).toBe(true);
    expect(isFailedBillingStatus("canceled")).toBe(true);
    expect(isFailedBillingStatus("active")).toBe(false);
    expect(isFailedBillingStatus("past_due")).toBe(false);
    expect(isFailedBillingStatus(null)).toBe(false);
  });

  it("protects active projection from a different non-active subscription", () => {
    const activeB = {
      stripeSubscriptionId: "sub_B",
      status: "active",
    };
    expect(
      shouldReplaceSubscriptionProjection(activeB, {
        id: "sub_A",
        status: "canceled",
      }),
    ).toBe(false);
    expect(
      shouldReplaceSubscriptionProjection(activeB, {
        id: "sub_A",
        status: "past_due",
      }),
    ).toBe(false);
    expect(
      shouldReplaceSubscriptionProjection(activeB, {
        id: "sub_B",
        status: "canceled",
      }),
    ).toBe(true);
    expect(
      shouldReplaceSubscriptionProjection(
        { stripeSubscriptionId: "sub_A", status: "past_due" },
        { id: "sub_B", status: "active" },
      ),
    ).toBe(true);
    expect(
      shouldReplaceSubscriptionProjection(null, {
        id: "sub_1",
        status: "active",
      }),
    ).toBe(true);
    // Neither entitled: allow replacement across subscription ids.
    expect(
      shouldReplaceSubscriptionProjection(
        { stripeSubscriptionId: "sub_A", status: "past_due" },
        { id: "sub_B", status: "canceled" },
      ),
    ).toBe(true);
  });

  it("incoming active subscription always wins over a different active projection", () => {
    expect(
      shouldReplaceSubscriptionProjection(
        { stripeSubscriptionId: "sub_A", status: "active" },
        { id: "sub_B", status: "active" },
      ),
    ).toBe(true);
  });
});
