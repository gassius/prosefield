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
import { HeroEditorPreview } from "@/components/marketing/hero-editor-preview";

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
  it("is decorative: aria-hidden and inert, with no focusable controls", () => {
    const html = renderToStaticMarkup(createElement(HeroEditorPreview));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toMatch(/\sinert(\s|>|=)/);
    expect(html).not.toMatch(/<a\b|<button\b|<input\b|<select\b|<textarea\b/);
    expect(html).toContain("the tools close");
    expect(html).toContain(
      "A short brief that the whole team can read in two minutes",
    );
  });
});
