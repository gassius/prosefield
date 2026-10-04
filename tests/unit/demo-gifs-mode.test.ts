import { afterEach, describe, expect, it, vi } from "vitest";
import { localDevDefaults } from "@/lib/env";
import {
  DEMO_GIFS_STRIPE_PRICE_ID,
  DEMO_GIFS_STRIPE_SECRET_KEY,
  DEMO_GIFS_STRIPE_WEBHOOK_SECRET,
  DemoGifsBillingError,
  applyDemoGifsBillingEnv,
  isDemoGifsBillingMode,
  isDemoGifsLocalAllowList,
} from "@/features/billing/demo-gifs-mode";
import {
  FAKE_STRIPE_PRICE_ID,
  FAKE_STRIPE_SECRET_KEY,
  FAKE_STRIPE_WEBHOOK_SECRET,
} from "../fixtures/stripe";

/** Happy path for `pnpm start` + `demo:gifs` (production Node + emulators). */
function allowedDemoEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    PROSEFIELD_DEMO_GIFS: "1",
    ALLOW_EMULATORS: "1",
    NODE_ENV: "production",
    APP_URL: "http://127.0.0.1:3000",
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    STRIPE_SECRET_KEY: localDevDefaults.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: localDevDefaults.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_ID: localDevDefaults.STRIPE_PRICE_ID,
    ...overrides,
  };
}

describe("isDemoGifsLocalAllowList", () => {
  it("accepts local production+emulators recording env", () => {
    expect(isDemoGifsLocalAllowList(allowedDemoEnv())).toBe(true);
  });

  it("accepts non-production without ALLOW_EMULATORS when hosts are loopback", () => {
    expect(
      isDemoGifsLocalAllowList(
        allowedDemoEnv({
          ALLOW_EMULATORS: undefined,
          NODE_ENV: "development",
        }),
      ),
    ).toBe(true);
  });

  it("rejects when VERCEL is set", () => {
    expect(isDemoGifsLocalAllowList(allowedDemoEnv({ VERCEL: "1" }))).toBe(
      false,
    );
  });

  it("rejects self-hosted production without ALLOW_EMULATORS", () => {
    expect(
      isDemoGifsLocalAllowList(
        allowedDemoEnv({
          ALLOW_EMULATORS: undefined,
          NODE_ENV: "production",
        }),
      ),
    ).toBe(false);
  });

  it("rejects non-loopback APP_URL or emulator hosts", () => {
    expect(
      isDemoGifsLocalAllowList(
        allowedDemoEnv({ APP_URL: "https://prosefield.example" }),
      ),
    ).toBe(false);
    expect(
      isDemoGifsLocalAllowList(
        allowedDemoEnv({
          FIREBASE_AUTH_EMULATOR_HOST: "auth.internal:9099",
        }),
      ),
    ).toBe(false);
    expect(
      isDemoGifsLocalAllowList(
        allowedDemoEnv({ FIRESTORE_EMULATOR_HOST: undefined }),
      ),
    ).toBe(false);
  });

  it("accepts bracketed loopback IPv6 emulator hosts and localhost APP_URL", () => {
    expect(
      isDemoGifsLocalAllowList(
        allowedDemoEnv({
          APP_URL: "http://localhost:3000",
          FIREBASE_AUTH_EMULATOR_HOST: "[::1]:9099",
          FIRESTORE_EMULATOR_HOST: "[::1]:8080",
        }),
      ),
    ).toBe(true);
  });

  it("accepts bare loopback emulator host without a port", () => {
    expect(
      isDemoGifsLocalAllowList(
        allowedDemoEnv({
          FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1",
          FIRESTORE_EMULATOR_HOST: "localhost",
        }),
      ),
    ).toBe(true);
  });

  it("rejects malformed APP_URL and broken IPv6 emulator host brackets", () => {
    expect(
      isDemoGifsLocalAllowList(allowedDemoEnv({ APP_URL: "not-a-url" })),
    ).toBe(false);
    expect(
      isDemoGifsLocalAllowList(
        allowedDemoEnv({ FIREBASE_AUTH_EMULATOR_HOST: "[::1" }),
      ),
    ).toBe(false);
  });

  it("rejects blank APP_URL", () => {
    expect(
      isDemoGifsLocalAllowList(allowedDemoEnv({ APP_URL: undefined })),
    ).toBe(false);
    expect(isDemoGifsLocalAllowList(allowedDemoEnv({ APP_URL: "  " }))).toBe(
      false,
    );
  });
});

describe("isDemoGifsBillingMode", () => {
  it("is off when the flag is unset (no throw)", () => {
    expect(isDemoGifsBillingMode({})).toBe(false);
    expect(
      isDemoGifsBillingMode(allowedDemoEnv({ PROSEFIELD_DEMO_GIFS: undefined })),
    ).toBe(false);
  });

  it("is on for the allowed local recording case", () => {
    expect(isDemoGifsBillingMode(allowedDemoEnv())).toBe(true);
  });

  it("throws on Vercel preview / production / development", () => {
    for (const vercelEnv of ["preview", "production", "development"] as const) {
      expect(() =>
        isDemoGifsBillingMode(
          allowedDemoEnv({ VERCEL: "1", VERCEL_ENV: vercelEnv }),
        ),
      ).toThrow(DemoGifsBillingError);
    }
  });

  it("throws on self-hosted production without ALLOW_EMULATORS", () => {
    expect(() =>
      isDemoGifsBillingMode(
        allowedDemoEnv({
          ALLOW_EMULATORS: undefined,
          NODE_ENV: "production",
          APP_URL: "https://prosefield.example",
          FIREBASE_AUTH_EMULATOR_HOST: undefined,
          FIRESTORE_EMULATOR_HOST: undefined,
        }),
      ),
    ).toThrow(DemoGifsBillingError);
  });

  it("throws when APP_URL or emulator hosts are not loopback", () => {
    expect(() =>
      isDemoGifsBillingMode(
        allowedDemoEnv({ APP_URL: "https://app.example.com" }),
      ),
    ).toThrow(DemoGifsBillingError);
    expect(() =>
      isDemoGifsBillingMode(
        allowedDemoEnv({
          FIREBASE_AUTH_EMULATOR_HOST: "10.0.0.2:9099",
        }),
      ),
    ).toThrow(DemoGifsBillingError);
  });
});

describe("applyDemoGifsBillingEnv", () => {
  it("is a no-op when the demo switch is off", () => {
    const env = {
      STRIPE_SECRET_KEY: localDevDefaults.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: localDevDefaults.STRIPE_WEBHOOK_SECRET,
      STRIPE_PRICE_ID: localDevDefaults.STRIPE_PRICE_ID,
    };
    expect(applyDemoGifsBillingEnv(env)).toBe(false);
    expect(env.STRIPE_SECRET_KEY).toBe(localDevDefaults.STRIPE_SECRET_KEY);
    expect(env).not.toHaveProperty("STRIPE_API_HOST");
  });

  it("throws (does not rewrite) when the flag is set on Vercel production", () => {
    const env = allowedDemoEnv({
      VERCEL: "1",
      VERCEL_ENV: "production",
    });
    expect(() => applyDemoGifsBillingEnv(env)).toThrow(DemoGifsBillingError);
    expect(env.STRIPE_SECRET_KEY).toBe(localDevDefaults.STRIPE_SECRET_KEY);
  });

  it("throws on Vercel preview instead of enabling fixtures", () => {
    const env = allowedDemoEnv({ VERCEL: "1", VERCEL_ENV: "preview" });
    expect(() => applyDemoGifsBillingEnv(env)).toThrow(DemoGifsBillingError);
    expect(env.STRIPE_SECRET_KEY).toBe(localDevDefaults.STRIPE_SECRET_KEY);
  });

  it("throws on self-hosted production so blank Stripe vars still fail closed", () => {
    const env = {
      PROSEFIELD_DEMO_GIFS: "1",
      NODE_ENV: "production",
      APP_URL: "https://prosefield.example",
      STRIPE_SECRET_KEY: "",
      STRIPE_WEBHOOK_SECRET: undefined,
      STRIPE_PRICE_ID: "   ",
    };
    expect(() => applyDemoGifsBillingEnv(env)).toThrow(DemoGifsBillingError);
    expect(env.STRIPE_SECRET_KEY).toBe("");
    expect(env).not.toHaveProperty("STRIPE_API_HOST");
  });

  it("applies fixtures on the allowed local path (including blanks)", () => {
    const env = allowedDemoEnv({
      STRIPE_SECRET_KEY: "   ",
      STRIPE_WEBHOOK_SECRET: undefined,
      STRIPE_PRICE_ID: "",
    });
    expect(applyDemoGifsBillingEnv(env)).toBe(true);
    expect(env.STRIPE_SECRET_KEY).toBe(DEMO_GIFS_STRIPE_SECRET_KEY);
    expect(env.STRIPE_WEBHOOK_SECRET).toBe(DEMO_GIFS_STRIPE_WEBHOOK_SECRET);
    expect(env.STRIPE_PRICE_ID).toBe(DEMO_GIFS_STRIPE_PRICE_ID);
    expect(env.STRIPE_API_HOST).toBe("127.0.0.1");
    expect(env.STRIPE_API_PORT).toBe("12111");
    expect(env.STRIPE_API_PROTOCOL).toBe("http");
  });

  it("applies fixtures when keys are placeholders on the allow-list", () => {
    const env = allowedDemoEnv();
    expect(applyDemoGifsBillingEnv(env)).toBe(true);
    expect(env.STRIPE_SECRET_KEY).toBe(DEMO_GIFS_STRIPE_SECRET_KEY);
    expect(env.STRIPE_SECRET_KEY).not.toContain("replaceme");
  });

  it("refuses non-placeholder Stripe keys (never redirect real keys to loopback)", () => {
    const env = allowedDemoEnv({
      STRIPE_SECRET_KEY: FAKE_STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: FAKE_STRIPE_WEBHOOK_SECRET,
      STRIPE_PRICE_ID: FAKE_STRIPE_PRICE_ID,
    });
    expect(() => applyDemoGifsBillingEnv(env)).toThrow(DemoGifsBillingError);
    expect(env.STRIPE_SECRET_KEY).toBe(FAKE_STRIPE_SECRET_KEY);
    expect(env).not.toHaveProperty("STRIPE_API_HOST");
  });

  it("makes isBillingConfigured true after applying demo fixtures", async () => {
    vi.resetModules();
    const mutable = allowedDemoEnv();
    expect(applyDemoGifsBillingEnv(mutable)).toBe(true);
    const { isBillingConfigured } = await import(
      "@/features/billing/configured"
    );
    expect(
      isBillingConfigured({
        ...localDevDefaults,
        FEATURE_CUSTOMER_PORTAL: false,
        STRIPE_SECRET_KEY: mutable.STRIPE_SECRET_KEY!,
        STRIPE_WEBHOOK_SECRET: mutable.STRIPE_WEBHOOK_SECRET!,
        STRIPE_PRICE_ID: mutable.STRIPE_PRICE_ID!,
      } as never),
    ).toBe(true);
  });
});

describe("demo-gifs instrumentation wiring", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock("@/lib/env");
    vi.doUnmock("@/lib/startup-env");
    vi.doUnmock("@/lib/env-defaults");
    vi.doUnmock("@/features/billing/demo-gifs-mode");
  });

  it("register applies demo GIF billing env before startup assert", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "test");

    const callOrder: string[] = [];
    const assertStartupEnv = vi.fn(async () => {
      callOrder.push("assert");
    });
    const applyLocalDevDefaultsToProcessEnv = vi.fn();
    const applyDemoGifsBillingEnvMock = vi.fn(() => {
      callOrder.push("demo");
      return true;
    });
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    vi.doMock("@/lib/startup-env", () => ({ assertStartupEnv }));
    vi.doMock("@/lib/env-defaults", () => ({
      localDevDefaults: {},
      applyLocalDevDefaultsToProcessEnv,
    }));
    vi.doMock("@/features/billing/demo-gifs-mode", () => ({
      applyDemoGifsBillingEnv: applyDemoGifsBillingEnvMock,
    }));

    vi.spyOn(process, "exit").mockImplementation((() => undefined) as unknown as (
      code?: string | number | null | undefined,
    ) => never);

    const { register } = await import("../../src/instrumentation");
    await register();

    expect(applyLocalDevDefaultsToProcessEnv).toHaveBeenCalledTimes(1);
    expect(applyDemoGifsBillingEnvMock).toHaveBeenCalledTimes(1);
    expect(assertStartupEnv).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(["demo", "assert"]);
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Demo GIF billing fixtures/i),
    );
  });

  it("register exits non-zero when demo GIF mode throws (disallowed env)", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "test");

    const assertStartupEnv = vi.fn(async () => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as unknown as (
        code?: string | number | null | undefined,
      ) => never);

    vi.doMock("@/lib/startup-env", () => ({ assertStartupEnv }));
    vi.doMock("@/lib/env-defaults", () => ({
      localDevDefaults: {},
      applyLocalDevDefaultsToProcessEnv: vi.fn(),
    }));
    vi.doMock("@/features/billing/demo-gifs-mode", () => ({
      applyDemoGifsBillingEnv: () => {
        throw new DemoGifsBillingError("disallowed");
      },
    }));

    const { register } = await import("../../src/instrumentation");
    await register();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(assertStartupEnv).not.toHaveBeenCalled();
    expect(JSON.stringify(errorSpy.mock.calls[0])).toMatch(/disallowed|DemoGifs/i);
  });

  it("register skips demo fixtures banner when apply returns false", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "test");

    const assertStartupEnv = vi.fn(async () => undefined);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    vi.doMock("@/lib/startup-env", () => ({ assertStartupEnv }));
    vi.doMock("@/lib/env-defaults", () => ({
      localDevDefaults: {},
      applyLocalDevDefaultsToProcessEnv: vi.fn(),
    }));
    vi.doMock("@/features/billing/demo-gifs-mode", () => ({
      applyDemoGifsBillingEnv: vi.fn(() => false),
    }));

    vi.spyOn(process, "exit").mockImplementation((() => undefined) as unknown as (
      code?: string | number | null | undefined,
    ) => never);

    const { register } = await import("../../src/instrumentation");
    await register();

    expect(infoSpy).not.toHaveBeenCalledWith(
      expect.stringMatching(/Demo GIF billing fixtures/i),
    );
  });
});
