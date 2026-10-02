import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => createElement("a", { href, ...props }, children),
}));

import {
  AssuranceStrip,
} from "@/components/marketing/assurance-strip";
import { Benefits } from "@/components/marketing/benefits";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { Pricing } from "@/components/marketing/pricing";
import { getFaqItems, siteCopy } from "@/content/site";

describe("AssuranceStrip", () => {
  it("renders three assurances and uses BadgeEuro for EUR", () => {
    const { container } = render(
      createElement(AssuranceStrip, { currency: "EUR" }),
    );
    for (const item of siteCopy.assurance.items) {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    }
    expect(screen.getByRole("region", { name: siteCopy.assurance.regionLabel })).toBeInTheDocument();
    expect(container.querySelector(".lucide-badge-euro")).not.toBeNull();
    expect(container.querySelector(".lucide-dollar-sign")).toBeNull();
  });

  it("follows plan currency for the plan icon (Architecture §5.2)", () => {
    const { container: eur } = render(
      createElement(AssuranceStrip, { currency: "EUR" }),
    );
    expect(eur.querySelector(".lucide-badge-euro")).not.toBeNull();
    expect(eur.querySelector(".lucide-dollar-sign")).toBeNull();

    const { container: usd } = render(
      createElement(AssuranceStrip, { currency: "USD" }),
    );
    expect(usd.querySelector(".lucide-dollar-sign")).not.toBeNull();
    expect(usd.querySelector(".lucide-badge-euro")).toBeNull();

    const { container: gbp } = render(
      createElement(AssuranceStrip, { currency: "GBP" }),
    );
    expect(gbp.querySelector(".lucide-pound-sterling")).not.toBeNull();
  });
});

describe("Benefits", () => {
  it("renders the three-stage journey", () => {
    render(createElement(Benefits));
    expect(
      screen.getByRole("heading", { name: siteCopy.benefits.headline }),
    ).toBeInTheDocument();
    for (const stage of siteCopy.benefits.stages) {
      expect(
        screen.getByRole("heading", { name: stage.title }),
      ).toBeInTheDocument();
      expect(screen.getByText(stage.body)).toBeInTheDocument();
    }
  });
});

describe("Pricing", () => {
  it("shows a non-default getPlan price so a hard-coded €8 fails", () => {
    render(
      createElement(Pricing, {
        plan: {
          name: "Prosefield",
          price: "9",
          currency: "EUR",
          interval: "month",
          priceLabel: "€9/month",
          checkoutReassurance: "€9/month · Secure checkout",
        },
        ctaHref: "/register?next=/subscribe",
        checkoutReassurance: "€9/month · Secure checkout",
      }),
    );

    expect(
      screen.getByRole("heading", { name: siteCopy.pricing.headline }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("pricing-card-price")).toHaveTextContent(
      "€9 /month",
    );
    expect(screen.queryByText(/€\s*8/)).not.toBeInTheDocument();
    for (const benefit of siteCopy.pricing.benefits) {
      expect(screen.getByText(benefit)).toBeInTheDocument();
    }
    expect(
      screen.getByRole("link", { name: siteCopy.header.cta }),
    ).toHaveAttribute("href", "/register?next=/subscribe");
  });
});

describe("Faq", () => {
  it("exposes accordion questions from site copy without cancel when gated off", async () => {
    const user = userEvent.setup();
    const items = getFaqItems({ FEATURE_CUSTOMER_PORTAL: "false" });
    render(createElement(Faq, { items }));

    expect(
      screen.getByRole("heading", { name: siteCopy.faq.headline }),
    ).toBeInTheDocument();
    const first = screen.getByRole("button", { name: items[0].question });
    await user.click(first);
    expect(screen.getByText(items[0].answer)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: siteCopy.faq.cancelItem.question }),
    ).toBeNull();
  });

  it("shows the cancel FAQ when portal claims are allowed", () => {
    const items = getFaqItems(
      { FEATURE_CUSTOMER_PORTAL: "true" },
      { portalRouteReady: true },
    );
    render(createElement(Faq, { items }));
    expect(
      screen.getByRole("button", { name: siteCopy.faq.cancelItem.question }),
    ).toBeInTheDocument();
  });
});

describe("FinalCta", () => {
  it("closes with the canonical CTA and reassurance", () => {
    render(
      createElement(FinalCta, {
        ctaHref: "/subscribe",
        checkoutReassurance: "€8/month · Secure checkout",
      }),
    );
    expect(
      screen.getByRole("heading", { name: siteCopy.finalCta.headline }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: siteCopy.header.cta }),
    ).toHaveAttribute("href", "/subscribe");
    expect(screen.getByText("€8/month · Secure checkout")).toBeInTheDocument();
  });
});
