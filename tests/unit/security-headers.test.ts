import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  CONTENT_SECURITY_POLICY,
  HSTS_HEADER,
  SECURITY_HEADERS,
} from "@/lib/security-headers";
import { proxy } from "@/proxy";
import { parseEnv, assembleLocalDevEncryptionKek } from "@/lib/env";

describe("transport security headers and cookies", () => {
  it("defines HSTS, strict CSP, and upgrade-insecure-requests", () => {
    expect(HSTS_HEADER).toMatch(/max-age=\d+/);
    expect(CONTENT_SECURITY_POLICY).toMatch(/upgrade-insecure-requests/);
    expect(CONTENT_SECURITY_POLICY).toMatch(/default-src 'self'/);
    expect(CONTENT_SECURITY_POLICY).toMatch(/frame-ancestors 'none'/);
    const keys = SECURITY_HEADERS.map((h) => h.key);
    expect(keys).toContain("Strict-Transport-Security");
    expect(keys).toContain("Content-Security-Policy");
  });

  it("next.config wires SECURITY_HEADERS for all paths", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "next.config.ts"),
      "utf8",
    );
    expect(source).toMatch(/SECURITY_HEADERS/);
    expect(source).toMatch(/async headers\(/);
    expect(source).toMatch(/source: "\/:path\*"/);
  });

  it("proxy attaches security headers on every response", () => {
    const response = proxy(new NextRequest("http://localhost:3000/"));
    expect(response.headers.get("Strict-Transport-Security")).toBe(HSTS_HEADER);
    expect(response.headers.get("Content-Security-Policy")).toBe(
      CONTENT_SECURITY_POLICY,
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
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
