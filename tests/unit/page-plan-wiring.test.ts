import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("HomePage plan wiring (n1)", () => {
  const source = readFileSync(
    path.resolve(__dirname, "../../src/app/page.tsx"),
    "utf8",
  );

  it("passes getPlan().checkoutReassurance into HeroCtaGroup", () => {
    expect(source).toContain("const plan = await getPlan()");
    expect(source).toMatch(
      /checkoutReassurance=\{\s*plan\.checkoutReassurance\s*\}/,
    );
    // Hard-coding the price in page.tsx must fail this suite (PR #6 carry-over n1).
    expect(source).not.toMatch(/checkoutReassurance=\{\s*["'`][^"'`]*€?\d/);
    // Reassignment after getPlan() must also fail.
    expect(source).not.toMatch(/plan\.checkoutReassurance\s*=/);
  });
});
