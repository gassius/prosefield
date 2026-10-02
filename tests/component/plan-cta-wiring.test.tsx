import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HeroCtaGroup } from "@/components/marketing/hero-cta-group";
import { siteCopy } from "@/content/site";

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
    expect(screen.queryByText(/€\s*8/)).not.toBeInTheDocument();
  });
});

vi.mock("@/features/auth/guards", () => ({
  getAccountState: vi.fn(async () => ({ kind: "logged_out" as const })),
  ctaDestinationForState: () => "/register?next=/subscribe",
}));

vi.mock("@/features/billing/plan", async () => {
  const { getPlanDisplay } = await import("@/features/billing/plan-display");
  return {
    getPlan: async () => getPlanDisplay(),
  };
});

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
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("HomePage plan price and portal FAQ wiring", () => {
  beforeEach(() => {
    vi.stubEnv("PLAN_DISPLAY_PRICE", "9");
    vi.stubEnv("PLAN_DISPLAY_CURRENCY", "EUR");
    vi.stubEnv("PLAN_DISPLAY_INTERVAL", "month");
    vi.stubEnv("FEATURE_CUSTOMER_PORTAL", "false");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("renders getPlan() price on the pricing card (fails if €8 is hard-coded)", async () => {
    const HomePage = (await import("@/app/page")).default;
    const ui = await HomePage();
    render(ui);

    expect(screen.getByTestId("pricing-card-price")).toHaveTextContent(
      "€9 /month",
    );
    // Spaced and unspaced €8 must not appear when plan is €9.
    expect(screen.queryByText(/€\s*8/)).not.toBeInTheDocument();

    const lines = screen.getAllByText("€9/month · Secure checkout");
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });

  it("omits cancel FAQ when the portal route is not ready even if the flag is on", async () => {
    vi.stubEnv("FEATURE_CUSTOMER_PORTAL", "true");
    vi.resetModules();
    const HomePage = (await import("@/app/page")).default;
    const ui = await HomePage();
    render(ui);

    expect(
      screen.queryByRole("button", { name: siteCopy.faq.cancelItem.question }),
    ).toBeNull();
    expect(screen.queryByText(siteCopy.home.cancelAnytime)).toBeNull();
  });
});
