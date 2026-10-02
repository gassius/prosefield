import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
  CultivatedMark,
  ProsefieldLogo,
  cultivatedMarkPathCount,
} from "@/components/brand/prosefield-logo";
import { HeroCtaGroup } from "@/components/marketing/hero-cta-group";
import { HeroEditorPreview } from "@/components/marketing/hero-editor-preview";

function rootTag(html: string): string {
  const match = html.match(/^<([a-z0-9]+)([^>]*)>/i);
  if (!match) {
    throw new Error(`Expected a root tag in: ${html.slice(0, 80)}`);
  }
  return match[0];
}

describe("cultivatedMarkPathCount", () => {
  it("uses the simplified three-path mark under 24px", () => {
    expect(cultivatedMarkPathCount(16)).toBe(3);
    expect(cultivatedMarkPathCount(23)).toBe(3);
  });

  it("uses the full six-path mark at 24px and above", () => {
    expect(cultivatedMarkPathCount(24)).toBe(6);
    expect(cultivatedMarkPathCount(40)).toBe(6);
  });
});

describe("CultivatedMark", () => {
  it("renders three paths at 16px and six at 24px", () => {
    const small = renderToStaticMarkup(createElement(CultivatedMark, { size: 16 }));
    const full = renderToStaticMarkup(createElement(CultivatedMark, { size: 24 }));
    expect((small.match(/<path /g) ?? []).length).toBe(3);
    expect((full.match(/<path /g) ?? []).length).toBe(6);
  });
});

describe("ProsefieldLogo", () => {
  it("names the home link without duplicating the wordmark", () => {
    const html = renderToStaticMarkup(createElement(ProsefieldLogo));
    expect(html).toContain('aria-label="Prosefield home"');
    expect(html).not.toContain("sr-only");
  });
});

describe("HeroEditorPreview", () => {
  it("is decorative: root aria-hidden + inert, no focusable controls", () => {
    const html = renderToStaticMarkup(createElement(HeroEditorPreview));
    const root = rootTag(html);
    expect(root).toContain('aria-hidden="true"');
    expect(root).toMatch(/\sinert(=""|\s|>)/);
    expect(html).not.toMatch(
      /<a\b|<button\b|<input\b|<select\b|<textarea\b|tabindex=/i,
    );
  });

  it("shows three document timestamps and a Quote toolbar icon", () => {
    const html = renderToStaticMarkup(createElement(HeroEditorPreview));
    expect((html.match(/<time\b/g) ?? []).length).toBe(3);
    expect(html).toContain("Edited 2 minutes ago");
    expect(html).toContain("Edited yesterday");
    expect(html).toContain("Edited 28 September");
    expect(html).toContain("lucide-quote");
    expect(html).not.toContain("lucide-image");
    expect(html).toContain("the tools close");
    expect(html).toContain(
      "A short brief that the whole team can read in two minutes",
    );
  });
});

describe("HeroCtaGroup", () => {
  it("uses full-width mobile CTAs and the plan reassurance line", () => {
    const html = renderToStaticMarkup(
      createElement(HeroCtaGroup, {
        ctaHref: "/register?next=/subscribe",
        checkoutReassurance: "€8/month · Secure checkout",
      }),
    );
    expect(html).toContain("€8/month · Secure checkout");
    // Both CTAs must include w-full for mobile stacking (§16).
    const fullWidthMatches = html.match(/w-full/g) ?? [];
    expect(fullWidthMatches.length).toBeGreaterThanOrEqual(2);
  });
});
