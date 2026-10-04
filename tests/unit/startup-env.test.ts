import { afterEach, describe, expect, it, vi } from "vitest";

describe("startup env fail-closed", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock("@/lib/env");
    vi.doUnmock("@/lib/startup-env");
    vi.doUnmock("@/lib/env-defaults");
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

  it("instrumentation register awaits assertStartupEnv and exits on failure", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "test");

    const assertStartupEnv = vi.fn(async () => {
      throw new Error("startup failed");
    });
    vi.doMock("@/lib/startup-env", () => ({ assertStartupEnv }));
    vi.doMock("@/lib/env-defaults", () => ({
      localDevDefaults: {},
      applyLocalDevDefaultsToProcessEnv: vi.fn(),
    }));

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as unknown as (
        code?: string | number | null | undefined,
      ) => never);

    const { register } = await import("../../src/instrumentation");
    await register();

    expect(assertStartupEnv).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("instrumentation register awaits assertStartupEnv once on success", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "test");

    const assertStartupEnv = vi.fn(async () => undefined);
    const applyLocalDevDefaultsToProcessEnv = vi.fn();
    vi.doMock("@/lib/startup-env", () => ({ assertStartupEnv }));
    vi.doMock("@/lib/env-defaults", () => ({
      localDevDefaults: {},
      applyLocalDevDefaultsToProcessEnv,
    }));

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as unknown as (
        code?: string | number | null | undefined,
      ) => never);

    const { register } = await import("../../src/instrumentation");
    await register();

    expect(assertStartupEnv).toHaveBeenCalledTimes(1);
    expect(applyLocalDevDefaultsToProcessEnv).toHaveBeenCalledTimes(1);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("instrumentation register logs when applying local defaults for blank keys", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_URL", "   ");

    const assertStartupEnv = vi.fn(async () => undefined);
    const applyLocalDevDefaultsToProcessEnv = vi.fn();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    vi.doMock("@/lib/startup-env", () => ({ assertStartupEnv }));
    vi.doMock("@/lib/env-defaults", () => ({
      localDevDefaults: { APP_URL: "http://localhost:3000" },
      applyLocalDevDefaultsToProcessEnv,
    }));

    vi.spyOn(process, "exit").mockImplementation((() => undefined) as unknown as (
      code?: string | number | null | undefined,
    ) => never);

    const { register } = await import("../../src/instrumentation");
    await register();

    expect(assertStartupEnv).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringMatching(/built-in local defaults/i),
    );
  });

  it("instrumentation register skips assertStartupEnv when not nodejs runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");

    const assertStartupEnv = vi.fn(async () => undefined);
    vi.doMock("@/lib/startup-env", () => ({ assertStartupEnv }));

    const { register } = await import("../../src/instrumentation");
    await register();

    expect(assertStartupEnv).not.toHaveBeenCalled();
  });

  it("instrumentation register redacts non-Error startup failures", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "test");

    const assertStartupEnv = vi.fn(async () => {
      throw "plain-string-failure";
    });
    vi.doMock("@/lib/startup-env", () => ({ assertStartupEnv }));
    vi.doMock("@/lib/env-defaults", () => ({
      localDevDefaults: {},
      applyLocalDevDefaultsToProcessEnv: vi.fn(),
    }));

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as unknown as (
        code?: string | number | null | undefined,
      ) => never);

    const { register } = await import("../../src/instrumentation");
    await register();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(JSON.stringify(errorSpy.mock.calls[0])).toContain("unknown");
    expect(JSON.stringify(errorSpy.mock.calls[0])).toContain(
      "plain-string-failure",
    );
  });

  it("instrumentation register skips defaults banner in production", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "production");

    const assertStartupEnv = vi.fn(async () => undefined);
    const applyLocalDevDefaultsToProcessEnv = vi.fn();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.doMock("@/lib/startup-env", () => ({ assertStartupEnv }));
    vi.doMock("@/lib/env-defaults", () => ({
      localDevDefaults: { APP_URL: "http://localhost:3000" },
      applyLocalDevDefaultsToProcessEnv,
    }));

    vi.spyOn(process, "exit").mockImplementation((() => undefined) as unknown as (
      code?: string | number | null | undefined,
    ) => never);

    const { register } = await import("../../src/instrumentation");
    await register();

    expect(assertStartupEnv).toHaveBeenCalledTimes(1);
    expect(infoSpy).not.toHaveBeenCalled();
  });
});
