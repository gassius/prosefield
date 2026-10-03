import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FAKE_STRIPE_PRICE_ID,
  FAKE_STRIPE_SECRET_KEY,
  FAKE_STRIPE_WEBHOOK_SECRET,
} from "../fixtures/stripe";

type StripeCtorOpts = {
  typescript?: boolean;
  host?: string;
  port?: number;
  protocol?: "http" | "https";
};

const stripeCtor = vi.hoisted(() =>
  vi.fn(function StripeMock(
    this: { key: string; opts: StripeCtorOpts },
    key: string,
    opts: StripeCtorOpts = {},
  ) {
    this.key = key;
    this.opts = opts;
  }),
);

vi.mock("stripe", () => ({
  default: stripeCtor,
}));

function stubBillingEnv() {
  vi.stubEnv("STRIPE_SECRET_KEY", FAKE_STRIPE_SECRET_KEY);
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", FAKE_STRIPE_WEBHOOK_SECRET);
  vi.stubEnv("STRIPE_PRICE_ID", FAKE_STRIPE_PRICE_ID);
}

async function loadGetStripe() {
  const { __resetEnvCacheForTests } = await import("@/lib/env");
  __resetEnvCacheForTests();
  const { getStripe, __resetStripeClientForTests } = await import(
    "@/lib/stripe/server"
  );
  __resetStripeClientForTests();
  stripeCtor.mockClear();
  return getStripe;
}

describe("getStripe", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns a cached Stripe client for the configured secret", async () => {
    stubBillingEnv();
    const getStripe = await loadGetStripe();
    const a = getStripe();
    const b = getStripe();
    expect(a).toBe(b);
    expect(stripeCtor).toHaveBeenCalledTimes(1);
  });

  it("points the client at STRIPE_API_HOST when set on loopback (CI visual mock)", async () => {
    stubBillingEnv();
    vi.stubEnv("STRIPE_API_HOST", "127.0.0.1");
    vi.stubEnv("STRIPE_API_PORT", "12111");
    vi.stubEnv("STRIPE_API_PROTOCOL", "http");
    const getStripe = await loadGetStripe();
    getStripe();
    expect(stripeCtor).toHaveBeenCalledWith(
      FAKE_STRIPE_SECRET_KEY,
      expect.objectContaining({
        typescript: true,
        host: "127.0.0.1",
        port: 12111,
        protocol: "http",
      }),
    );
  });

  it("defaults port 12111 and https when only STRIPE_API_HOST is set", async () => {
    stubBillingEnv();
    vi.stubEnv("STRIPE_API_HOST", "127.0.0.1");
    vi.stubEnv("STRIPE_API_PORT", undefined);
    vi.stubEnv("STRIPE_API_PROTOCOL", undefined);
    const getStripe = await loadGetStripe();
    getStripe();
    expect(stripeCtor).toHaveBeenCalledWith(
      FAKE_STRIPE_SECRET_KEY,
      expect.objectContaining({
        host: "127.0.0.1",
        port: 12111,
        protocol: "https",
      }),
    );
  });

  it("allows localhost and ::1 loopback overrides", async () => {
    stubBillingEnv();
    vi.stubEnv("STRIPE_API_HOST", "localhost");
    vi.stubEnv("STRIPE_API_PROTOCOL", "http");
    let getStripe = await loadGetStripe();
    getStripe();
    expect(stripeCtor.mock.calls.at(-1)?.[1]).toMatchObject({
      host: "localhost",
      protocol: "http",
    });

    vi.resetModules();
    stubBillingEnv();
    vi.stubEnv("STRIPE_API_HOST", "::1");
    vi.stubEnv("STRIPE_API_PROTOCOL", "http");
    getStripe = await loadGetStripe();
    getStripe();
    expect(stripeCtor.mock.calls.at(-1)?.[1]).toMatchObject({
      host: "::1",
      protocol: "http",
    });
  });

  it("ignores non-loopback STRIPE_API_HOST without the allow flag", async () => {
    stubBillingEnv();
    vi.stubEnv("STRIPE_API_HOST", "evil.example.com");
    vi.stubEnv("STRIPE_API_PORT", "443");
    vi.stubEnv("STRIPE_API_PROTOCOL", "http");
    vi.stubEnv("STRIPE_API_ALLOW_NON_LOOPBACK", undefined);
    const getStripe = await loadGetStripe();
    getStripe();
    const opts = stripeCtor.mock.calls.at(-1)?.[1] as StripeCtorOpts;
    expect(opts.host).toBeUndefined();
    expect(opts.port).toBeUndefined();
    expect(opts.protocol).toBeUndefined();
    expect(opts.typescript).toBe(true);
  });

  it("allows non-loopback override only with STRIPE_API_ALLOW_NON_LOOPBACK=1", async () => {
    stubBillingEnv();
    vi.stubEnv("STRIPE_API_HOST", "stripe-mock.ci.internal");
    vi.stubEnv("STRIPE_API_PORT", "8443");
    vi.stubEnv("STRIPE_API_PROTOCOL", "https");
    vi.stubEnv("STRIPE_API_ALLOW_NON_LOOPBACK", "1");
    const getStripe = await loadGetStripe();
    getStripe();
    expect(stripeCtor).toHaveBeenCalledWith(
      FAKE_STRIPE_SECRET_KEY,
      expect.objectContaining({
        host: "stripe-mock.ci.internal",
        port: 8443,
        protocol: "https",
      }),
    );
  });
});
