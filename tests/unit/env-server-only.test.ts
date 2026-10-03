import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("env.ts server-only boundary", () => {
  it("keeps import \"server-only\" on env.ts (defaults live in env-defaults)", () => {
    const envSource = readFileSync(
      path.resolve(__dirname, "../../src/lib/env.ts"),
      "utf8",
    );
    const defaultsSource = readFileSync(
      path.resolve(__dirname, "../../src/lib/env-defaults.ts"),
      "utf8",
    );
    const nextConfig = readFileSync(
      path.resolve(__dirname, "../../next.config.ts"),
      "utf8",
    );

    expect(envSource.startsWith('import "server-only"')).toBe(true);
    expect(defaultsSource).not.toMatch(/^import ["']server-only["']/m);
    expect(nextConfig).toContain('from "./src/lib/env-defaults"');
    expect(nextConfig).not.toContain('from "./src/lib/env"');
  });
});

