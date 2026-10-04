import { afterEach, describe, expect, it, vi } from "vitest";
import { localDevDefaults } from "@/lib/env";
import {
  DEMO_GIFS_STRIPE_PRICE_ID,
  DEMO_GIFS_STRIPE_SECRET_KEY,
  DEMO_GIFS_STRIPE_WEBHOOK_SECRET,
  applyDemoGifsBillingEnv,
  isDemoGifsBillingMode,
} from "@/features/billing/demo-gifs-mode";
import {
  FAKE_STRIPE_PRICE_ID,
  FAKE_STRIPE_SECRET_KEY,
  FAKE_STRIPE_WEBHOOK_SECRET,
} from "../fixtures/stripe";

describe("isDemoGifsBillingMode", () => {
  it("is off by default", () => {
    expect(isDemoGifsBillingMode({})).toBe(false);
  });

  it("is on when PROSEFIELD_DEMO_GIFS=1 outside production", () => {
    expect(
      isDemoGifsBillingMode({ PROSEFIELD_DEMO_GIFS: "1", VERCEL_ENV: "preview" }),
    ).toBe(true);
    expect(isDemoGifsBillingMode({ PROSEFIELD_DEMO_GIFS: "1" })).toBe(true);
  });

  it("is inert when VERCEL_ENV=production even if the flag is set", () => {
    expect(
      isDemoGifsBillingMode({
        PROSEFIELD_DEMO_GIFS: "1",
        VERCEL_ENV: "production",
      }),
    ).toBe(false);
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

  it("is inert in Vercel production (does not rewrite keys)", () => {
    const env = {
      PROSEFIELD_DEMO_GIFS: "1",
      VERCEL_ENV: "production",
      STRIPE_SECRET_KEY: localDevDefaults.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: localDevDefaults.STRIPE_WEBHOOK_SECRET,
      STRIPE_PRICE_ID: localDevDefaults.STRIPE_PRICE_ID,
    };
    expect(applyDemoGifsBillingEnv(env)).toBe(false);
    expect(env.STRIPE_SECRET_KEY).toBe(localDevDefaults.STRIPE_SECRET_KEY);
  });

  it("applies non-placeholder fixtures and loopback mock host in demo mode", () => {
    const env: Record<string, string | undefined> = {
      PROSEFIELD_DEMO_GIFS: "1",
      STRIPE_SECRET_KEY: localDevDefaults.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: localDevDefaults.STRIPE_WEBHOOK_SECRET,
      STRIPE_PRICE_ID: localDevDefaults.STRIPE_PRICE_ID,
    };
    expect(applyDemoGifsBillingEnv(env)).toBe(true);
    expect(env.STRIPE_SECRET_KEY).toBe(DEMO_GIFS_STRIPE_SECRET_KEY);
    expect(env.STRIPE_WEBHOOK_SECRET).toBe(DEMO_GIFS_STRIPE_WEBHOOK_SECRET);
    expect(env.STRIPE_PRICE_ID).toBe(DEMO_GIFS_STRIPE_PRICE_ID);
    expect(env.STRIPE_API_HOST).toBe("127.0.0.1");
    expect(env.STRIPE_API_PORT).toBe("12111");
    expect(env.STRIPE_API_PROTOCOL).toBe("http");
    expect(env.STRIPE_SECRET_KEY).not.toContain("replaceme");
  });

  it("does not clobber non-placeholder Stripe values already set", () => {
    const env: Record<string, string | undefined> = {
      PROSEFIELD_DEMO_GIFS: "1",
      STRIPE_SECRET_KEY: FAKE_STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: FAKE_STRIPE_WEBHOOK_SECRET,
      STRIPE_PRICE_ID: FAKE_STRIPE_PRICE_ID,
      STRIPE_API_HOST: "127.0.0.1",
      STRIPE_API_PORT: "9999",
      STRIPE_API_PROTOCOL: "http",
    };
    expect(applyDemoGifsBillingEnv(env)).toBe(true);
    expect(env.STRIPE_SECRET_KEY).toBe(FAKE_STRIPE_SECRET_KEY);
    expect(env.STRIPE_API_PORT).toBe("9999");
  });

  it("makes isBillingConfigured true after applying demo fixtures", async () => {
    vi.resetModules();
    const envBag = {
      ...localDevDefaults,
      FEATURE_CUSTOMER_PORTAL: false as const,
      PROSEFIELD_DEMO_GIFS: "1",
    };
    const mutable: Record<string, string | undefined> = {
      ...Object.fromEntries(
        Object.entries(localDevDefaults).map(([k, v]) => [k, String(v)]),
      ),
      PROSEFIELD_DEMO_GIFS: "1",
    };
    expect(applyDemoGifsBillingEnv(mutable)).toBe(true);
    const { isBillingConfigured } = await import(
      "@/features/billing/configured"
    );
    expect(
      isBillingConfigured({
        ...envBag,
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

    const assertStartupEnv = vi.fn(async () => undefined);
    const applyLocalDevDefaultsToProcessEnv = vi.fn();
    const applyDemoGifsBillingEnvMock = vi.fn(() => true);
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
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Demo GIF billing fixtures/i),
    );
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
