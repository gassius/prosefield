import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("upgrade-gate display-3 typography", () => {
  const files = [
    "../../src/app/(workspace)/documents/page.tsx",
    "../../src/app/(workspace)/documents/[documentId]/page.tsx",
  ];

  it("uses display-3 size classes on the upgrade h1", () => {
    for (const rel of files) {
      const source = readFileSync(path.resolve(__dirname, rel), "utf8");
      expect(source).toMatch(
        /<h1 className="font-display text-xl font-medium tracking-tight sm:text-2xl"/,
      );
      // Bite: the old oversized display-2-ish classes must not return.
      expect(source).not.toMatch(
        /<h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl"/,
      );
    }
  });
});
