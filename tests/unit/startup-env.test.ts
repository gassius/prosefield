import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("startup env fail-closed", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.doUnmock("@/lib/env");
  });

  it("assertStartupEnv calls getEnv (removal of the startup check fails this)", async () => {
    const getEnv = vi.fn(() => ({ ok: true }));
    vi.doMock("@/lib/env", () => ({ getEnv }));
    const { assertStartupEnv } = await import("@/lib/startup-env");
    await assertStartupEnv();
    expect(getEnv).toHaveBeenCalledTimes(1);
  });

  it("assertStartupEnv surfaces getEnv failures so register can exit", async () => {
    vi.doMock("@/lib/env", () => ({
      getEnv: () => {
        throw new Error("emulator hosts forbidden in production");
      },
    }));
    const { assertStartupEnv } = await import("@/lib/startup-env");
    await expect(assertStartupEnv()).rejects.toThrow(/emulator hosts/i);
  });

  it("instrumentation register awaits assertStartupEnv and exits on failure", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../../src/instrumentation.ts"),
      "utf8",
    );
    expect(source).toContain("assertStartupEnv");
    expect(source).toMatch(/process\.exit\s*\(\s*1\s*\)/);
    // Bite: deleting the startup check leaves neither call nor exit.
    expect(source).not.toMatch(/\/\/\s*getEnv\(\)/);
  });
});
