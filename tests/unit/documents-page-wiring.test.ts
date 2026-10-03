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

  // documentId validation bite → tests/unit/document-page.test.ts (finding 14).
});
