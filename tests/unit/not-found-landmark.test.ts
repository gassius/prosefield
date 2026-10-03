import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("not-found page landmark", () => {
  it("renders PageMain (main landmark) with siteCopy", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../../src/app/not-found.tsx"),
      "utf8",
    );
    expect(source).toContain("PageMain");
    expect(source).toContain("siteCopy.notFound");
    expect(source).not.toMatch(/["']Page not found["']/);
  });
});
