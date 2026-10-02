import { describe, expect, it } from "vitest";
import {
  isEntitledStatus,
  isFailedBillingStatus,
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

  it("marks terminal failure statuses for the billing status page", () => {
    expect(isFailedBillingStatus("incomplete_expired")).toBe(true);
    expect(isFailedBillingStatus("unpaid")).toBe(true);
    expect(isFailedBillingStatus("canceled")).toBe(true);
    expect(isFailedBillingStatus("active")).toBe(false);
    expect(isFailedBillingStatus("past_due")).toBe(false);
    expect(isFailedBillingStatus(null)).toBe(false);
  });
});
