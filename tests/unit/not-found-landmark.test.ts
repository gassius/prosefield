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

  it("root layout awaits connection() so 404 HTML stays dynamic (N12)", () => {
    const layout = readFileSync(
      path.resolve(__dirname, "../../src/app/layout.tsx"),
      "utf8",
    );
    expect(layout).toMatch(/await\s+connection\s*\(/);
    // not-found uses the root layout; no static export escape hatch.
    const notFound = readFileSync(
      path.resolve(__dirname, "../../src/app/not-found.tsx"),
      "utf8",
    );
    expect(notFound).not.toMatch(/export\s+const\s+dynamic\s*=\s*["']force-static["']/);
  });
});
