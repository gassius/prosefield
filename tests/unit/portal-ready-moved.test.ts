import { describe, expect, it } from "vitest";
import { isCustomerPortalRouteReady } from "@/content/site";

describe("portal-ready switch (item 15)", () => {
  it("stays false until P6 ships — moved to ClickUp 869faej6k", () => {
    // P6 Customer Portal (869faej6k) has not shipped POST /api/billing/portal.
    // Tying isCustomerPortalRouteReady() to the real route is tracked there.
    expect(isCustomerPortalRouteReady()).toBe(false);
  });
});
