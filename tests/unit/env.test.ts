import { afterEach, describe, expect, it, vi } from "vitest";
import { envSchema, mergeEnvSource, parseEnv } from "@/lib/env";

const validEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-prosefield.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-prosefield",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:0000000000000000000000",
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099",
  APP_URL: "http://localhost:3000",
  FIREBASE_PROJECT_ID: "demo-prosefield",
  STRIPE_SECRET_KEY: "sk_test_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
  STRIPE_PRICE_ID: "price_example",
  FEATURE_CUSTOMER_PORTAL: "false",
  PLAN_DISPLAY_NAME: "Prosefield",
  PLAN_DISPLAY_PRICE: "9",
  PLAN_DISPLAY_CURRENCY: "EUR",
  PLAN_DISPLAY_INTERVAL: "month",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
} as const;

describe("env schema", () => {
  it("accepts a complete test configuration", () => {
    const env = parseEnv(validEnv);
    expect(env.FIREBASE_PROJECT_ID).toBe("demo-prosefield");
    expect(env.FEATURE_CUSTOMER_PORTAL).toBe(false);
    expect(env.STRIPE_SECRET_KEY).toBe("sk_test_example");
  });

  it("trims Stripe keys before validating", () => {
    const env = parseEnv({
      ...validEnv,
      STRIPE_SECRET_KEY: "  sk_test_example  ",
      STRIPE_WEBHOOK_SECRET: "  whsec_example  ",
    });
    expect(env.STRIPE_SECRET_KEY).toBe("sk_test_example");
    expect(env.STRIPE_WEBHOOK_SECRET).toBe("whsec_example");
  });

  it("rejects live Stripe secret keys", () => {
    const result = envSchema.safeParse({
      ...validEnv,
      STRIPE_SECRET_KEY: "sk_live_example",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "STRIPE_SECRET_KEY")).toBe(
        true,
      );
    }
  });

  it("rejects a sk_test_ prefix with no key material", () => {
    const result = envSchema.safeParse({
      ...validEnv,
      STRIPE_SECRET_KEY: "sk_test_",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a blank webhook secret", () => {
    const result = envSchema.safeParse({
      ...validEnv,
      STRIPE_WEBHOOK_SECRET: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-demo Firebase project ids", () => {
    const result = envSchema.safeParse({
      ...validEnv,
      FIREBASE_PROJECT_ID: "production-prosefield",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "production-prosefield",
    });
    expect(result.success).toBe(false);
  });

  it("parses FEATURE_CUSTOMER_PORTAL as a boolean", () => {
    const env = parseEnv({
      ...validEnv,
      FEATURE_CUSTOMER_PORTAL: "true",
    });
    expect(env.FEATURE_CUSTOMER_PORTAL).toBe(true);
  });

  it("accepts config without emulator hosts (frontend without backend)", () => {
    const { FIREBASE_AUTH_EMULATOR_HOST, FIRESTORE_EMULATOR_HOST, ...withoutEmulators } =
      validEnv;
    void FIREBASE_AUTH_EMULATOR_HOST;
    void FIRESTORE_EMULATOR_HOST;
    const {
      NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST,
      ...withoutPublicEmulator
    } = withoutEmulators;
    void NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
    const env = parseEnv(withoutPublicEmulator);
    expect(env.FIREBASE_AUTH_EMULATOR_HOST).toBeUndefined();
    expect(env.FIRESTORE_EMULATOR_HOST).toBeUndefined();
    expect(env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST).toBeUndefined();
  });

  describe("mergeEnvSource local defaults", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("fills blanks outside production so bare pnpm dev can start", () => {
      vi.stubEnv("NODE_ENV", "development");
      const merged = mergeEnvSource({});
      expect(merged.APP_URL).toBe("http://localhost:3000");
      expect(merged.STRIPE_SECRET_KEY).toBe("sk_test_replaceme");
      expect(parseEnv(merged).FIREBASE_PROJECT_ID).toBe("demo-prosefield");
    });

    it("does not apply defaults in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      const merged = mergeEnvSource({});
      expect(merged.APP_URL).toBeUndefined();
    });
  });
});
