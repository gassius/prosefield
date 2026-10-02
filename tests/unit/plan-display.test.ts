import { afterEach, describe, expect, it } from "vitest";
import { getPlanDisplay } from "@/features/billing/plan-display";
import { localDevDefaults } from "@/lib/env";

describe("getPlanDisplay", () => {
  afterEach(() => {
    // Clear getEnv cache between cases by resetting module cache is heavy;
    // assert against the live env merge instead.
  });

  it("formats checkout reassurance from PLAN_DISPLAY_* fallback", () => {
    const plan = getPlanDisplay();
    expect(plan.price).toBe(
      process.env.PLAN_DISPLAY_PRICE ?? localDevDefaults.PLAN_DISPLAY_PRICE,
    );
    expect(plan.checkoutReassurance).toBe(
      `${plan.priceLabel} · Secure checkout`,
    );
    expect(plan.checkoutReassurance).toMatch(/\/month · Secure checkout$/);
  });
});
