import { afterEach, describe, expect, it, vi } from "vitest";

describe("server logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logError/logInfo/logWarn redact details and support message-only calls", async () => {
    const { logError, logInfo, logWarn } = await import("@/lib/logger");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logError("only-message");
    logInfo("only-info");
    logWarn("only-warn");
    expect(errorSpy).toHaveBeenCalledWith("only-message");
    expect(infoSpy).toHaveBeenCalledWith("only-info");
    expect(warnSpy).toHaveBeenCalledWith("only-warn");

    logError("with-detail", { email: "a@b.co" });
    logInfo("with-detail", { email: "a@b.co" });
    logWarn("with-detail", { email: "a@b.co" });
    expect(JSON.stringify(errorSpy.mock.calls.at(-1))).not.toContain("a@b.co");
    expect(JSON.stringify(infoSpy.mock.calls.at(-1))).toContain("[REDACTED]");
    expect(JSON.stringify(warnSpy.mock.calls.at(-1))).toContain("[REDACTED]");
  });
});
