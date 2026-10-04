import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CSRF_COOKIE_NAME } from "@/features/auth/constants";
import { proxy } from "@/proxy";

afterEach(() => {
  vi.unstubAllEnvs();
});

function csrfSecure(request: NextRequest): boolean | undefined {
  const response = proxy(request);
  return response.cookies.get(CSRF_COOKIE_NAME)?.secure;
}

describe("proxy CSRF cookie Secure / x-forwarded-proto", () => {
  it("sets Secure CSRF cookie when x-forwarded-proto is https behind http", () => {
    const request = new NextRequest("http://app.example/", {
      headers: { "x-forwarded-proto": "https" },
    });
    expect(csrfSecure(request)).toBe(true);
  });

  it("clears Secure when x-forwarded-proto is http", () => {
    const request = new NextRequest("https://app.example/", {
      headers: { "x-forwarded-proto": "http" },
    });
    expect(csrfSecure(request)).toBe(false);
  });

  it("uses the first hop when x-forwarded-proto is a list", () => {
    const httpsFirst = new NextRequest("http://app.example/", {
      headers: { "x-forwarded-proto": "https, http" },
    });
    expect(csrfSecure(httpsFirst)).toBe(true);

    const httpFirst = new NextRequest("http://app.example/", {
      headers: { "x-forwarded-proto": " http , https" },
    });
    expect(csrfSecure(httpFirst)).toBe(false);

    // Leading space on the first hop — bites if `.trim()` is dropped.
    const trimmedHttps = new NextRequest("http://app.example/", {
      headers: { "x-forwarded-proto": " https , http" },
    });
    expect(csrfSecure(trimmedHttps)).toBe(true);
  });

  it("uses request protocol when forwarded header is absent", () => {
    expect(csrfSecure(new NextRequest("https://app.example/"))).toBe(true);
    expect(csrfSecure(new NextRequest("http://app.example/"))).toBe(false);
  });

  it("never sets Secure on localhost even with forwarded https", () => {
    const request = new NextRequest("http://localhost:3000/", {
      headers: { "x-forwarded-proto": "https" },
    });
    expect(csrfSecure(request)).toBe(false);
  });

  it("does not overwrite an existing csrf_token cookie", () => {
    const request = new NextRequest("https://app.example/", {
      headers: { cookie: `${CSRF_COOKIE_NAME}=already-set` },
    });
    const response = proxy(request);
    expect(response.cookies.get(CSRF_COOKIE_NAME)).toBeUndefined();
  });

  it("sets Secure + SameSite on CSRF cookie and attaches HSTS/CSP headers", () => {
    const response = proxy(
      new NextRequest("https://app.example/", {
        headers: { "x-forwarded-proto": "https" },
      }),
    );
    const cookie = response.cookies.get(CSRF_COOKIE_NAME);
    expect(cookie?.secure).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(response.headers.get("Strict-Transport-Security")).toMatch(/max-age/);
    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toMatch(/upgrade-insecure-requests/);
    expect(csp).toMatch(/'nonce-/);
    expect(csp).toMatch(/strict-dynamic/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it("forces Secure CSRF cookie in production when APP_URL is https", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://app.example");
    const request = new NextRequest("http://app.example/", {
      headers: { "x-forwarded-proto": "http" },
    });
    expect(csrfSecure(request)).toBe(true);
    vi.unstubAllEnvs();
  });
});
