import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/content/site", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/content/site")>();
  return {
    ...actual,
    siteCopy: {
      ...actual.siteCopy,
      header: {
        ...actual.siteCopy.header,
        cta: "SENTINEL-HEADER-CTA",
      },
      benefits: {
        ...actual.siteCopy.benefits,
        headline: "SENTINEL-BENEFITS-HEADLINE",
      },
      pricing: {
        ...actual.siteCopy.pricing,
        headline: "SENTINEL-PRICING-HEADLINE",
      },
      faq: {
        ...actual.siteCopy.faq,
        headline: "SENTINEL-FAQ-HEADLINE",
      },
      finalCta: {
        ...actual.siteCopy.finalCta,
        headline: "SENTINEL-FINAL-CTA-HEADLINE",
      },
    },
  };
});

import { Benefits } from "@/components/marketing/benefits";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { Pricing } from "@/components/marketing/pricing";
import { siteCopy } from "@/content/site";

afterEach(() => {
  cleanup();
});

describe("Landing copy sentinel (siteCopy binding)", () => {
  it("Benefits headline comes from siteCopy (sentinel)", () => {
    render(createElement(Benefits));
    expect(
      screen.getByRole("heading", { name: "SENTINEL-BENEFITS-HEADLINE" }),
    ).toBeInTheDocument();
  });

  it("Pricing headline and CTA come from siteCopy (sentinel)", () => {
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
        ctaHref: "/subscribe",
        checkoutReassurance: "€8/month · Secure checkout",
      }),
    );
    expect(
      screen.getByRole("heading", { name: "SENTINEL-PRICING-HEADLINE" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "SENTINEL-HEADER-CTA" }),
    ).toBeInTheDocument();
  });

  it("Faq headline comes from siteCopy (sentinel)", () => {
    render(
      createElement(Faq, {
        items: [{ id: "sentinel", question: "Q", answer: "A" }],
      }),
    );
    expect(
      screen.getByRole("heading", { name: "SENTINEL-FAQ-HEADLINE" }),
    ).toBeInTheDocument();
  });

  it("FinalCta headline and link label come from siteCopy (sentinel)", () => {
    render(
      createElement(FinalCta, {
        ctaHref: "/subscribe",
        checkoutReassurance: "€8/month · Secure checkout",
      }),
    );
    expect(
      screen.getByRole("heading", { name: "SENTINEL-FINAL-CTA-HEADLINE" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "SENTINEL-HEADER-CTA" }),
    ).toHaveAttribute("href", "/subscribe");
    // Bite: hard-coding the real English CTA string must fail this suite.
    expect(siteCopy.header.cta).toBe("SENTINEL-HEADER-CTA");
  });
});
