import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("document page wiring", () => {
  const source = readFileSync(
    path.resolve(
      __dirname,
      "../../src/app/(workspace)/documents/[documentId]/page.tsx",
    ),
    "utf8",
  );

  it("passes contentAllowed from the loaded document (no fail-open omit)", () => {
    expect(source).toMatch(/contentAllowed=\{\s*doc\.contentAllowed\s*\}/);
    // Hard-coding true / omitting the prop must fail this suite.
    expect(source).not.toMatch(/contentAllowed=\{\s*true\s*\}/);
    expect(source).not.toMatch(/contentAllowed=\{\s*false\s*\}/);
  });

  it("validates documentId before Firestore lookup and 404s on failure", () => {
    expect(source).toContain("documentIdSchema.safeParse(documentId)");
    expect(source).toMatch(/if\s*\(\s*!documentIdSchema\.safeParse/);
    expect(source).toContain("notFound()");
  });
});
