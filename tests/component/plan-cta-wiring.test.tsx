import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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

vi.mock("@/features/auth/guards", () => ({
  getAccountState: vi.fn(async () => ({ kind: "logged_out" as const })),
  ctaDestinationForState: () => "/register?next=/subscribe",
}));

vi.mock("@/components/marketing/site-header", () => ({
  SiteHeader: () => null,
}));

vi.mock("@/components/marketing/site-footer", () => ({
  SiteFooter: () => null,
}));

vi.mock("@/components/marketing/hero-editor-preview", () => ({
  HeroEditorPreview: () => null,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => <a href={href} {...props}>{children}</a>,
}));

describe("HomePage renders plan.checkoutReassurance from env", () => {
  beforeEach(() => {
    vi.stubEnv("PLAN_DISPLAY_PRICE", "9");
    vi.stubEnv("PLAN_DISPLAY_CURRENCY", "EUR");
    vi.stubEnv("PLAN_DISPLAY_INTERVAL", "month");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("fails if page.tsx reassigns or hard-codes checkoutReassurance", async () => {
    const HomePage = (await import("@/app/page")).default;
    const ui = await HomePage();
    render(ui);

    expect(screen.getByText("€9/month · Secure checkout")).toBeInTheDocument();
    expect(screen.queryByText(/€8\/month/)).not.toBeInTheDocument();
  });
});
