import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertValidOrigin,
  csrfTokensMatch,
  fingerprintToken,
  parseCookieValue,
  readCsrfFromRequest,
} from "@/features/auth/csrf";

describe("csrf helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fingerprints tokens without echoing the raw value", () => {
    const fp = fingerprintToken("secret-token-value");
    expect(fp).toHaveLength(12);
    expect(fp).not.toContain("secret");
    expect(fingerprintToken("secret-token-value")).toBe(fp);
    expect(fingerprintToken("other")).not.toBe(fp);
  });

  it("reads cookie and header CSRF tokens from a request", () => {
    const request = new Request("http://localhost:3000/api/session", {
      headers: {
        cookie: "a=1; csrf_token=from-cookie; b=2",
        "x-csrf-token": "from-header",
      },
    });
    expect(readCsrfFromRequest(request)).toEqual({
      cookieToken: "from-cookie",
      headerToken: "from-header",
    });
  });

  it("returns undefined cookie token when the cookie is absent", () => {
    const request = new Request("http://localhost:3000/api/session", {
      headers: { "x-csrf-token": "only-header" },
    });
    expect(readCsrfFromRequest(request)).toEqual({
      cookieToken: undefined,
      headerToken: "only-header",
    });
  });

  it("returns undefined header token when the CSRF header is absent", () => {
    const request = new Request("http://localhost:3000/api/session", {
      headers: { cookie: "csrf_token=from-cookie" },
    });
    expect(readCsrfFromRequest(request)).toEqual({
      cookieToken: "from-cookie",
      headerToken: undefined,
    });
  });

  it("rejects mismatched lengths without throwing", () => {
    expect(csrfTokensMatch("abcd", "ab")).toBe(false);
  });

  it("returns false when equal string lengths yield unequal Buffer lengths", () => {
    // JS string length matches, but UTF-8 byte lengths differ → timingSafeEqual throws.
    expect(csrfTokensMatch("é", "a")).toBe(false);
    expect(csrfTokensMatch("a", "é")).toBe(false);
  });

  it("parses the last matching cookie value segment", () => {
    expect(parseCookieValue("csrf_token=a=b=c", "csrf_token")).toBe("a=b=c");
  });

  it("rejects a malformed Origin header", () => {
    process.env.APP_URL = "http://localhost:3000";
    expect(
      assertValidOrigin(
        new Request("http://localhost:3000/api/session", {
          headers: { origin: "::::" },
        }),
      ),
    ).toBe(false);
  });
});
