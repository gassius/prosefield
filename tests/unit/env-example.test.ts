import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe(".env.example ALLOW_EMULATORS", () => {
  it("defaults ALLOW_EMULATORS off (commented) so deploys stay fail-closed", () => {
    const text = readFileSync(
      path.resolve(__dirname, "../../.env.example"),
      "utf8",
    );
    // Active assignment must not ship; keep a commented example for local prod-mode.
    expect(text).toMatch(/#\s*ALLOW_EMULATORS=1/);
    expect(text).not.toMatch(/^\s*ALLOW_EMULATORS=1\s*$/m);
  });
});
