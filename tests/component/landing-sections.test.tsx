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

import { AssuranceStrip } from "@/components/marketing/assurance-strip";
import { Benefits } from "@/components/marketing/benefits";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { Pricing } from "@/components/marketing/pricing";
import { getFaqItems, siteCopy } from "@/content/site";

describe("AssuranceStrip", () => {
  it("renders three assurances including a euro plan icon", () => {
    const { container } = render(createElement(AssuranceStrip));
    for (const item of siteCopy.assurance.items) {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    }
    expect(container.querySelector(".lucide-badge-euro")).not.toBeNull();
    expect(container.querySelector(".lucide-dollar-sign")).toBeNull();
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
  it("shows getPlan price label, implemented benefits, and CTA", () => {
    render(
      createElement(Pricing, {
        plan: {
          name: "Prosefield",
          price: "8",
          currency: "EUR",
          interval: "month",
          priceLabel: "€8/month",
          checkoutReassurance: "€8/month · Secure checkout",
        },
        ctaHref: "/register?next=/subscribe",
        checkoutReassurance: "€8/month · Secure checkout",
      }),
    );

    expect(
      screen.getByRole("heading", { name: siteCopy.pricing.headline }),
    ).toBeInTheDocument();
    expect(screen.getByText("€8 /month")).toBeInTheDocument();
    for (const benefit of siteCopy.pricing.benefits) {
      expect(screen.getByText(benefit)).toBeInTheDocument();
    }
    expect(
      screen.getByRole("link", { name: siteCopy.header.cta }),
    ).toHaveAttribute("href", "/register?next=/subscribe");
  });
});

describe("Faq", () => {
  it("exposes accordion questions from site copy", async () => {
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
