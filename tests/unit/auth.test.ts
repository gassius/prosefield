import { describe, expect, it } from "vitest";
import { ctaDestinationForState } from "@/features/auth/account-state";
import {
  assertValidOrigin,
  csrfTokensMatch,
  parseCookieValue,
} from "@/features/auth/csrf";
import { isRecentAuthTime } from "@/features/auth/auth-time";
import { isAllowedNextPath, resolveNextPath } from "@/features/auth/next";

describe("resolveNextPath", () => {
  it("accepts allow-listed paths", () => {
    expect(resolveNextPath("/subscribe")).toBe("/subscribe");
    expect(resolveNextPath("/documents")).toBe("/documents");
  });

  it("rejects open redirects and falls back", () => {
    expect(resolveNextPath("https://evil.example")).toBe("/subscribe");
    expect(resolveNextPath("//evil.example")).toBe("/subscribe");
    expect(resolveNextPath("/subscribe?x=1")).toBe("/subscribe");
    expect(resolveNextPath("/unknown")).toBe("/subscribe");
    expect(resolveNextPath(null, "/documents")).toBe("/documents");
  });

  it("reports allow-list membership", () => {
    expect(isAllowedNextPath("/subscribe")).toBe(true);
    expect(isAllowedNextPath("/login")).toBe(false);
  });
});

describe("ctaDestinationForState", () => {
  it("routes by account state", () => {
    expect(ctaDestinationForState({ kind: "logged_out" })).toBe(
      "/register?next=/subscribe",
    );
    expect(
      ctaDestinationForState({
        kind: "logged_in",
        uid: "u1",
        email: "a@b.c",
        subscriptionActive: false,
      }),
    ).toBe("/subscribe");
    expect(
      ctaDestinationForState({
        kind: "subscriber",
        uid: "u1",
        email: "a@b.c",
        subscriptionActive: true,
      }),
    ).toBe("/documents");
  });
});

describe("csrfTokensMatch", () => {
  it("requires equal tokens", () => {
    expect(csrfTokensMatch("abc", "abc")).toBe(true);
    expect(csrfTokensMatch("abc", "abd")).toBe(false);
    expect(csrfTokensMatch(undefined, "abc")).toBe(false);
    expect(csrfTokensMatch("abc", undefined)).toBe(false);
  });

  it("parses cookie headers", () => {
    expect(parseCookieValue("a=1; csrf_token=tok; b=2", "csrf_token")).toBe(
      "tok",
    );
  });
});

describe("assertValidOrigin", () => {
  it("accepts matching APP_URL origin", () => {
    process.env.APP_URL = "http://localhost:3000";
    const request = new Request("http://localhost:3000/api/session", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    });
    expect(assertValidOrigin(request)).toBe(true);
  });

  it("rejects missing or foreign origin", () => {
    process.env.APP_URL = "http://localhost:3000";
    expect(
      assertValidOrigin(
        new Request("http://localhost:3000/api/session", { method: "POST" }),
      ),
    ).toBe(false);
    expect(
      assertValidOrigin(
        new Request("http://localhost:3000/api/session", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toBe(false);
  });
});

describe("isRecentAuthTime", () => {
  it("allows auth_time within five minutes", () => {
    const now = 1_700_000_000;
    expect(isRecentAuthTime(now - 60, now)).toBe(true);
    expect(isRecentAuthTime(now - 5 * 60, now)).toBe(true);
    expect(isRecentAuthTime(now - 5 * 60 - 1, now)).toBe(false);
  });
});
