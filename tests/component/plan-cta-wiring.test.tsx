import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { HeroCtaGroup } from "@/components/marketing/hero-cta-group";

describe("HeroCtaGroup plan display wiring (n1)", () => {
  beforeEach(() => {
    vi.stubEnv("PLAN_DISPLAY_PRICE", "9");
    vi.stubEnv("PLAN_DISPLAY_CURRENCY", "EUR");
    vi.stubEnv("PLAN_DISPLAY_INTERVAL", "month");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("renders a non-default PLAN_DISPLAY_PRICE from getPlanDisplay()", async () => {
    const { getPlanDisplay } = await import("@/features/billing/plan-display");
    const plan = getPlanDisplay();
    expect(plan.checkoutReassurance).toContain("€9/month");

    render(
      <HeroCtaGroup
        ctaHref="/register?next=/subscribe"
        checkoutReassurance={plan.checkoutReassurance}
      />,
    );

    expect(screen.getByText("€9/month · Secure checkout")).toBeInTheDocument();
    expect(screen.queryByText(/€8\/month/)).not.toBeInTheDocument();
  });
});
