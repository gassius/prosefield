import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  HSTS_HEADER,
  SECURITY_HEADERS,
  buildContentSecurityPolicy,
  buildStaticSecurityHeaders,
  parseCspDirectives,
  shouldAllowEmulatorCspOrigins,
  shouldAllowUnsafeEval,
} from "@/lib/security-headers";
import { proxy } from "@/proxy";
import { parseEnv, assembleLocalDevEncryptionKek } from "@/lib/env";
import nextConfig from "../../next.config";

function expectExactCspShape(policy: string, opts: { nonce: string; eval: boolean; emulators: boolean }) {
  const d = parseCspDirectives(policy);
  expect(d["default-src"]).toEqual(["'self'"]);
  expect(d["base-uri"]).toEqual(["'self'"]);
  expect(d["object-src"]).toEqual(["'none'"]);
  expect(d["frame-ancestors"]).toEqual(["'none'"]);
  expect(d["form-action"]).toEqual(["'self'"]);
  expect(d["upgrade-insecure-requests"]).toEqual([]);
  expect(d["style-src"]).toEqual(["'self'", "'unsafe-inline'"]);
  expect(d["script-src"]).toContain("'self'");
  expect(d["script-src"]).toContain(`'nonce-${opts.nonce}'`);
  expect(d["script-src"]).toContain("'strict-dynamic'");
  expect(d["script-src"]).not.toContain("'unsafe-inline'");
  if (opts.eval) {
    expect(d["script-src"]).toContain("'unsafe-eval'");
  } else {
    expect(d["script-src"]).not.toContain("'unsafe-eval'");
  }
  expect(d["connect-src"]).toContain("'self'");
  expect(d["connect-src"]).toContain("https://*.googleapis.com");
  if (opts.emulators) {
    expect(d["connect-src"]).toContain("http://127.0.0.1:9099");
  } else {
    expect(d["connect-src"]?.some((t) => t.startsWith("http://"))).toBe(false);
    expect(d["connect-src"]?.some((t) => t.startsWith("ws://"))).toBe(false);
  }
}

describe("transport security headers and cookies", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defines exact HSTS and static header set", () => {
    expect(HSTS_HEADER).toBe("max-age=63072000; includeSubDomains; preload");
    const keys = buildStaticSecurityHeaders().map((h) => h.key);
    expect(keys).toEqual([
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "X-Frame-Options",
    ]);
    expect(SECURITY_HEADERS.map((h) => h.key)).toEqual(keys);
    // Empty / nameless CSP segments are skipped (bites parse regressions).
    expect(parseCspDirectives(" ;  ; default-src 'self'; ; ")).toEqual({
      "default-src": ["'self'"],
    });
  });

  it("builds nonce CSP without unsafe-inline scripts; eval/emulators gated", () => {
    const prod = buildContentSecurityPolicy({
      nonce: "abc123",
      allowUnsafeEval: false,
      allowEmulatorOrigins: false,
    });
    expectExactCspShape(prod, { nonce: "abc123", eval: false, emulators: false });

    const dev = buildContentSecurityPolicy({
      nonce: "devnonce",
      allowUnsafeEval: true,
      allowEmulatorOrigins: true,
    });
    expectExactCspShape(dev, { nonce: "devnonce", eval: true, emulators: true });
  });

  it("kills CSP/HSTS loosening mutations (C3/C5/C6/C7/C9/C10)", () => {
    const policy = buildContentSecurityPolicy({
      nonce: "n",
      allowUnsafeEval: false,
      allowEmulatorOrigins: false,
    });
    const d = parseCspDirectives(policy);
    // C3 object-src removed
    expect(d["object-src"]).toEqual(["'none'"]);
    // C5 connect-src *
    expect(d["connect-src"]).not.toContain("*");
    expect(d["connect-src"]?.[0]).toBe("'self'");
    // C6 script-src *
    expect(d["script-src"]).not.toContain("*");
    // C7 base-uri removed
    expect(d["base-uri"]).toEqual(["'self'"]);
    // C9/C10 HSTS
    expect(HSTS_HEADER).toMatch(/max-age=63072000/);
    expect(HSTS_HEADER).not.toMatch(/max-age=0/);
    expect(HSTS_HEADER).toContain("includeSubDomains");
  });

  it("next.config.headers() returns static security headers (C12)", async () => {
    expect(typeof nextConfig.headers).toBe("function");
    const headers = await nextConfig.headers!();
    expect(headers.length).toBeGreaterThan(0);
    const entry = headers[0]!;
    expect(entry.source).toBe("/:path*");
    const map = Object.fromEntries(entry.headers.map((h) => [h.key, h.value]));
    expect(map["Strict-Transport-Security"]).toBe(HSTS_HEADER);
    expect(map["X-Frame-Options"]).toBe("DENY");
    expect(map["X-Content-Type-Options"]).toBe("nosniff");
    // CSP is per-request in proxy (nonce), not a static next.config value.
    expect(map["Content-Security-Policy"]).toBeUndefined();
  });

  it("proxy attaches nonce CSP + HSTS on every response", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_EMULATORS", "");
    const response = proxy(new NextRequest("https://app.example/"));
    expect(response.headers.get("Strict-Transport-Security")).toBe(HSTS_HEADER);
    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();
    const nonceMatch = csp!.match(/'nonce-([^']+)'/);
    expect(nonceMatch?.[1]).toBeTruthy();
    expectExactCspShape(csp!, {
      nonce: nonceMatch![1]!,
      eval: false,
      emulators: false,
    });
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("proxy allows unsafe-eval and emulator origins only outside strict production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(shouldAllowUnsafeEval()).toBe(true);
    expect(shouldAllowEmulatorCspOrigins()).toBe(true);
    const devCsp = proxy(new NextRequest("http://localhost:3000/")).headers.get(
      "Content-Security-Policy",
    )!;
    expect(devCsp).toContain("'unsafe-eval'");
    expect(devCsp).toContain("http://127.0.0.1:9099");

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_EMULATORS", "");
    expect(shouldAllowUnsafeEval()).toBe(false);
    expect(shouldAllowEmulatorCspOrigins()).toBe(false);

    vi.stubEnv("ALLOW_EMULATORS", "1");
    expect(shouldAllowEmulatorCspOrigins()).toBe(true);
  });

  it("rejects http:// APP_URL outside local dev", () => {
    const base = {
      NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-prosefield.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-prosefield",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:0000000000000000000000",
      FIREBASE_PROJECT_ID: "demo-prosefield",
      STRIPE_SECRET_KEY: "sk_test_example",
      STRIPE_WEBHOOK_SECRET: "whsec_example",
      STRIPE_PRICE_ID: "price_example",
      FEATURE_CUSTOMER_PORTAL: "false",
      PLAN_DISPLAY_NAME: "Prosefield",
      PLAN_DISPLAY_PRICE: "8",
      PLAN_DISPLAY_CURRENCY: "EUR",
      PLAN_DISPLAY_INTERVAL: "month",
      DOCUMENT_ENCRYPTION_PROVIDER: "dev",
      DOCUMENT_ENCRYPTION_KEY_VERSION: "1",
      DOCUMENT_ENCRYPTION_KEK: assembleLocalDevEncryptionKek(),
    };
    expect(() =>
      parseEnv({ ...base, APP_URL: "http://example.com" }),
    ).toThrow(/https/);
    expect(
      parseEnv({ ...base, APP_URL: "https://example.com" }).APP_URL,
    ).toBe("https://example.com");
    expect(
      parseEnv({ ...base, APP_URL: "http://localhost:3000" }).APP_URL,
    ).toBe("http://localhost:3000");
  });
});
