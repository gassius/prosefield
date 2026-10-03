import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("package.json dependency hygiene", () => {
  it("does not list unused sharp as a direct dependency", () => {
    const pkg = JSON.parse(
      readFileSync(path.resolve(__dirname, "../../package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.sharp).toBeUndefined();
    expect(pkg.devDependencies?.sharp).toBeUndefined();
    expect(pkg.optionalDependencies?.sharp).toBeUndefined();
  });
});
