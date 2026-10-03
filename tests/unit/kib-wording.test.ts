import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("document size wording", () => {
  it("uses KiB consistently (not mixed KB)", () => {
    const schema = readFileSync(
      path.resolve(__dirname, "../../src/features/documents/schemas.ts"),
      "utf8",
    );
    const architecture = readFileSync(
      path.resolve(__dirname, "../../docs/architecture.md"),
      "utf8",
    );
    const readme = readFileSync(
      path.resolve(__dirname, "../../README.md"),
      "utf8",
    );

    expect(schema).toMatch(/512 KiB/);
    expect(architecture).toMatch(/512 KiB/);
    expect(readme).toMatch(/512 KiB/);

    // Bite: reintroducing the mixed "512 KB" spelling fails.
    expect(architecture).not.toMatch(/512 KB/);
    expect(schema).not.toMatch(/512 KB/);
    expect(readme).not.toMatch(/512 KB/);
  });
});
