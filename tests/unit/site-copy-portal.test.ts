import { describe, expect, it } from "vitest";
import {
  checkoutReassuranceLine,
  formatPricingCardPrice,
  getFaqItems,
  isCustomerPortalEnabled,
  isCustomerPortalRouteReady,
  siteCopy,
} from "@/content/site";

describe("FEATURE_CUSTOMER_PORTAL + portal route gate", () => {
  it("keeps the portal route unready until /api/billing/portal ships", () => {
    expect(isCustomerPortalRouteReady()).toBe(false);
  });

  it("never enables cancel claims when the portal route is not ready", () => {
    expect(
      isCustomerPortalEnabled({ FEATURE_CUSTOMER_PORTAL: "true" }),
    ).toBe(false);
    expect(
      checkoutReassuranceLine("€8/month · Secure checkout", {
        FEATURE_CUSTOMER_PORTAL: "true",
      }),
    ).toBe("€8/month · Secure checkout");
    expect(
      getFaqItems({ FEATURE_CUSTOMER_PORTAL: "true" }).map((item) => item.id),
    ).not.toContain("cancel");
  });

  it("enables cancel claims only when flag is on AND portal route is ready", () => {
    const base = "€8/month · Secure checkout";
    expect(
      isCustomerPortalEnabled(
        { FEATURE_CUSTOMER_PORTAL: "true" },
        { portalRouteReady: true },
      ),
    ).toBe(true);
    expect(
      checkoutReassuranceLine(
        base,
        { FEATURE_CUSTOMER_PORTAL: "true" },
        { portalRouteReady: true },
      ),
    ).toBe(`${base} · ${siteCopy.home.cancelAnytime}`);

    const on = getFaqItems(
      { FEATURE_CUSTOMER_PORTAL: "true" },
      { portalRouteReady: true },
    );
    expect(on.map((item) => item.id)).toContain("cancel");
    expect(on.at(-1)).toMatchObject(siteCopy.faq.cancelItem);

    expect(
      isCustomerPortalEnabled(
        { FEATURE_CUSTOMER_PORTAL: "false" },
        { portalRouteReady: true },
      ),
    ).toBe(false);
  });

  it("formats the pricing card price from the plan label", () => {
    expect(formatPricingCardPrice("€9/month")).toBe("€9 /month");
    expect(formatPricingCardPrice("€8/month")).toBe("€8 /month");
  });
});
