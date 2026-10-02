import { describe, expect, it } from "vitest";
import {
  checkoutReassuranceLine,
  getFaqItems,
  isCustomerPortalEnabled,
  siteCopy,
} from "@/content/site";

describe("FEATURE_CUSTOMER_PORTAL copy gates", () => {
  it("treats missing/false as portal off", () => {
    expect(isCustomerPortalEnabled({})).toBe(false);
    expect(isCustomerPortalEnabled({ FEATURE_CUSTOMER_PORTAL: "false" })).toBe(
      false,
    );
  });

  it("enables cancel-anytime reassurance when the flag is true", () => {
    const base = "€8/month · Secure checkout";
    expect(checkoutReassuranceLine(base, {})).toBe(base);
    expect(
      checkoutReassuranceLine(base, { FEATURE_CUSTOMER_PORTAL: "true" }),
    ).toBe(`${base} · ${siteCopy.home.cancelAnytime}`);
  });

  it("adds the cancel FAQ only when the portal flag is true", () => {
    const off = getFaqItems({ FEATURE_CUSTOMER_PORTAL: "false" });
    expect(off.map((item) => item.id)).toEqual([
      "private",
      "subscribe",
      "mobile",
    ]);
    expect(off.some((item) => item.question.includes("cancel"))).toBe(false);

    const on = getFaqItems({ FEATURE_CUSTOMER_PORTAL: "true" });
    expect(on.map((item) => item.id)).toContain("cancel");
    expect(on.at(-1)).toMatchObject(siteCopy.faq.cancelItem);
  });
});
