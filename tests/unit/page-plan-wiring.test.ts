import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("HomePage plan wiring (n1)", () => {
  const source = readFileSync(
    path.resolve(__dirname, "../../src/app/page.tsx"),
    "utf8",
  );

  it("wires getPlan() through checkoutReassuranceLine into marketing CTAs", () => {
    expect(source).toContain("const plan = await getPlan()");
    expect(source).toContain(
      "const checkoutReassurance = checkoutReassuranceLine(plan.checkoutReassurance)",
    );
    expect(source).toMatch(/checkoutReassurance=\{\s*checkoutReassurance\s*\}/);
    // Hard-coding the price in page.tsx must fail this suite (PR #6 carry-over n1).
    expect(source).not.toMatch(/checkoutReassurance=\{\s*["'`][^"'`]*€?\d/);
    // Reassignment of plan.checkoutReassurance must also fail.
    expect(source).not.toMatch(/plan\.checkoutReassurance\s*=/);
  });

  it("composes real marketing sections (not sr-only stubs)", () => {
    expect(source).toContain("AssuranceStrip");
    expect(source).toContain("Benefits");
    expect(source).toContain("Pricing");
    expect(source).toContain("Faq");
    expect(source).toContain("FinalCta");
    expect(source).not.toMatch(/id="benefits"\s+className="sr-only"/);
  });
});
