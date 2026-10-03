import { describe, expect, it } from "vitest";
import {
  assertStripeTestSecretKey,
  detectEnvEol,
  getEnvKey,
  isStripeLiveSecretKey,
  isStripeTestSecretKey,
  upsertEnvKey,
} from "@/lib/stripe/dev-env";
import {
  FAKE_STRIPE_LIVE_RESTRICTED_KEY,
  FAKE_STRIPE_LIVE_SECRET_KEY,
  FAKE_STRIPE_RESTRICTED_KEY,
  FAKE_STRIPE_SECRET_KEY,
  PLACEHOLDER_STRIPE_SECRET_KEY,
} from "../fixtures/stripe";

const shortTestKey = ["sk", "test", "abc"].join("_");
const shortQuotedKey = ["sk", "test", "quoted"].join("_");

describe("upsertEnvKey (.env updater)", () => {
  it("inserts a missing key while preserving comments, ordering, and blank lines", () => {
    const original = [
      "# Stripe",
      `STRIPE_SECRET_KEY=${shortTestKey}`,
      "",
      "APP_URL=http://localhost:3000",
      "",
    ].join("\n");

    const next = upsertEnvKey(original, "STRIPE_PRICE_ID", "price_new");

    expect(next).toBe(
      [
        "# Stripe",
        `STRIPE_SECRET_KEY=${shortTestKey}`,
        "",
        "APP_URL=http://localhost:3000",
        "STRIPE_PRICE_ID=price_new",
      ].join("\n") + "\n",
    );
    expect(getEnvKey(next, "STRIPE_PRICE_ID")).toBe("price_new");
  });

  it("creates a one-line .env when content is empty", () => {
    expect(upsertEnvKey("", "STRIPE_PRICE_ID", "price_new")).toBe(
      "STRIPE_PRICE_ID=price_new\n",
    );
  });

  it("replaces an existing key in place without duplicating it", () => {
    const original = [
      "STRIPE_PRICE_ID=price_old",
      "FEATURE_CUSTOMER_PORTAL=false",
      "STRIPE_WEBHOOK_SECRET=whsec_old",
    ].join("\n");

    const next = upsertEnvKey(original, "STRIPE_PRICE_ID", "price_new");

    expect(next).toBe(
      [
        "STRIPE_PRICE_ID=price_new",
        "FEATURE_CUSTOMER_PORTAL=false",
        "STRIPE_WEBHOOK_SECRET=whsec_old",
      ].join("\n"),
    );
    expect(next.match(/STRIPE_PRICE_ID=/g)).toHaveLength(1);
  });

  it("keeps other lines intact when replacing a middle key", () => {
    const original = [
      "# keep me",
      "",
      `STRIPE_SECRET_KEY=${shortTestKey}`,
      "STRIPE_PRICE_ID=price_old",
      "",
      "# trailing comment",
      "PLAN_DISPLAY_NAME=Prosefield",
    ].join("\n");

    const next = upsertEnvKey(original, "STRIPE_PRICE_ID", "price_new");

    expect(next.split("\n")).toEqual([
      "# keep me",
      "",
      `STRIPE_SECRET_KEY=${shortTestKey}`,
      "STRIPE_PRICE_ID=price_new",
      "",
      "# trailing comment",
      "PLAN_DISPLAY_NAME=Prosefield",
    ]);
  });

  it("replaces a key when the file has no trailing newline", () => {
    const original = "STRIPE_PRICE_ID=price_old\nAPP_URL=http://localhost:3000";
    const next = upsertEnvKey(original, "STRIPE_PRICE_ID", "price_new");
    expect(next).toBe(
      "STRIPE_PRICE_ID=price_new\nAPP_URL=http://localhost:3000",
    );
    expect(next.endsWith("\n")).toBe(false);
  });

  it("appends when only a commented # KEY= line exists (does not uncomment)", () => {
    const commented = ["whsec", "commented"].join("_");
    const fresh = ["whsec", "freshvalue001"].join("_");
    const original = [
      `# STRIPE_WEBHOOK_SECRET=${commented}`,
      "APP_URL=http://localhost:3000",
      "",
    ].join("\n");
    const next = upsertEnvKey(original, "STRIPE_WEBHOOK_SECRET", fresh);
    expect(next).toContain(`# STRIPE_WEBHOOK_SECRET=${commented}`);
    expect(next.match(/STRIPE_WEBHOOK_SECRET=/g)).toHaveLength(2);
    expect(getEnvKey(next, "STRIPE_WEBHOOK_SECRET")).toBe(fresh);
  });

  it("leaves KEY_SUFFIX= untouched when upserting KEY", () => {
    const original = [
      "STRIPE_PRICE_ID_OLD=price_legacy",
      "APP_URL=http://localhost:3000",
      "",
    ].join("\n");
    const next = upsertEnvKey(original, "STRIPE_PRICE_ID", "price_new");
    expect(next).toContain("STRIPE_PRICE_ID_OLD=price_legacy");
    expect(next).toContain("STRIPE_PRICE_ID=price_new");
    expect(getEnvKey(next, "STRIPE_PRICE_ID")).toBe("price_new");
    expect(getEnvKey(next, "STRIPE_PRICE_ID_OLD")).toBe("price_legacy");
  });

  it("collapses duplicate KEY= lines to exactly one last-wins value (Node semantics)", () => {
    const original = [
      "STRIPE_PRICE_ID=price_first",
      "APP_URL=http://localhost:3000",
      "STRIPE_PRICE_ID=price_second",
      "",
    ].join("\n");
    expect(getEnvKey(original, "STRIPE_PRICE_ID")).toBe("price_second");
    const next = upsertEnvKey(original, "STRIPE_PRICE_ID", "price_new");
    expect(next.match(/STRIPE_PRICE_ID=/g)).toHaveLength(1);
    expect(getEnvKey(next, "STRIPE_PRICE_ID")).toBe("price_new");
    expect(next).toContain("APP_URL=http://localhost:3000");
    // Last duplicate's position is kept (after APP_URL).
    expect(next.indexOf("APP_URL=")).toBeLessThan(next.indexOf("STRIPE_PRICE_ID="));
  });

  it("preserves CRLF line endings", () => {
    const original = [
      "STRIPE_PRICE_ID=price_old",
      "APP_URL=http://localhost:3000",
      "",
    ].join("\r\n");
    expect(detectEnvEol(original)).toBe("\r\n");
    const next = upsertEnvKey(original, "STRIPE_PRICE_ID", "price_new");
    expect(next).toContain("\r\n");
    expect(next.split("\r\n")).toEqual([
      "STRIPE_PRICE_ID=price_new",
      "APP_URL=http://localhost:3000",
      "",
    ]);
  });

  it("rejects live keys (sk_live_ / rk_live_)", () => {
    expect(() => assertStripeTestSecretKey(FAKE_STRIPE_LIVE_SECRET_KEY)).toThrow(
      /live key/,
    );
    expect(() =>
      assertStripeTestSecretKey(FAKE_STRIPE_LIVE_RESTRICTED_KEY),
    ).toThrow(/live key/);
    expect(isStripeLiveSecretKey(FAKE_STRIPE_LIVE_SECRET_KEY)).toBe(true);
    expect(isStripeLiveSecretKey(FAKE_STRIPE_LIVE_RESTRICTED_KEY)).toBe(true);
  });
});

describe("assertStripeTestSecretKey", () => {
  it("accepts sk_test_ and rk_test_ keys", () => {
    expect(() => assertStripeTestSecretKey(FAKE_STRIPE_SECRET_KEY)).not.toThrow();
    expect(() =>
      assertStripeTestSecretKey(FAKE_STRIPE_RESTRICTED_KEY),
    ).not.toThrow();
    expect(isStripeTestSecretKey(FAKE_STRIPE_SECRET_KEY)).toBe(true);
    expect(isStripeTestSecretKey(FAKE_STRIPE_RESTRICTED_KEY)).toBe(true);
  });

  it("fails clearly when the key is missing", () => {
    expect(() => assertStripeTestSecretKey(undefined)).toThrow(
      /Missing STRIPE_SECRET_KEY/,
    );
    expect(() => assertStripeTestSecretKey("   ")).toThrow(
      /Missing STRIPE_SECRET_KEY/,
    );
  });

  it("rejects placeholders and non-test prefixes", () => {
    expect(() => assertStripeTestSecretKey(PLACEHOLDER_STRIPE_SECRET_KEY)).toThrow(
      /must be a Stripe test key/,
    );
    expect(() => assertStripeTestSecretKey("pk_test_abc")).toThrow(
      /must be a Stripe test key/,
    );
  });
});

describe("getEnvKey", () => {
  it("reads quoted values and skips comments", () => {
    const content = [
      "# comment",
      `STRIPE_SECRET_KEY="${shortQuotedKey}"`,
      "export STRIPE_PRICE_ID='price_quoted'",
      "",
      "APP_URL=http://localhost:3000",
    ].join("\n");
    expect(getEnvKey(content, "STRIPE_SECRET_KEY")).toBe(shortQuotedKey);
    expect(getEnvKey(content, "STRIPE_PRICE_ID")).toBe("price_quoted");
    expect(getEnvKey(content, "MISSING")).toBeUndefined();
  });

  it("returns the last duplicate (Node last-wins)", () => {
    const content = [
      "STRIPE_PRICE_ID=price_first",
      "STRIPE_PRICE_ID=price_last",
    ].join("\n");
    expect(getEnvKey(content, "STRIPE_PRICE_ID")).toBe("price_last");
  });
});
