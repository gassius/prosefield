import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetEnvCacheForTests,
  applyLocalDevDefaultsToProcessEnv,
  envSchema,
  mergeEnvSource,
  parseEnv,
} from "@/lib/env";

const validEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-prosefield.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-prosefield",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:0000000000000000000000",
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  APP_URL: "http://localhost:3000",
  FIREBASE_PROJECT_ID: "demo-prosefield",
  STRIPE_SECRET_KEY: "sk_test_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
  STRIPE_PRICE_ID: "price_example",
  FEATURE_CUSTOMER_PORTAL: "false",
  PLAN_DISPLAY_NAME: "Prosefield",
  PLAN_DISPLAY_PRICE: "8",
  PLAN_DISPLAY_CURRENCY: "EUR",
  PLAN_DISPLAY_INTERVAL: "month",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
} as const;

describe("env schema", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    __resetEnvCacheForTests();
  });

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

  it("accepts rk_test_ restricted Stripe secret keys", () => {
    const restricted = ["rk", "test", "example"].join("_");
    const env = parseEnv({
      ...validEnv,
      STRIPE_SECRET_KEY: restricted,
    });
    expect(env.STRIPE_SECRET_KEY).toBe(restricted);
  });

  it("rejects rk_live_ restricted live keys", () => {
    const result = envSchema.safeParse({
      ...validEnv,
      STRIPE_SECRET_KEY: ["rk", "live", "example"].join("_"),
    });
    expect(result.success).toBe(false);
  });

  it("rejects malformed keys that would pass an unanchored regex (F8e)", () => {
    expect(
      envSchema.safeParse({
        ...validEnv,
        STRIPE_SECRET_KEY: "xsk_test_abc",
      }).success,
    ).toBe(false);
    expect(
      envSchema.safeParse({
        ...validEnv,
        STRIPE_SECRET_KEY: "sk_test_abc!",
      }).success,
    ).toBe(false);
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

  it("rejects emulator hosts in production without ALLOW_EMULATORS", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_EMULATORS", "");
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          String(issue.path[0]).includes("EMULATOR"),
        ),
      ).toBe(true);
    }
  });

  it("allows emulator hosts in production when ALLOW_EMULATORS=1", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_EMULATORS", "1");
    expect(envSchema.safeParse(validEnv).success).toBe(true);
  });

  it("accepts production config without emulator hosts", () => {
    vi.stubEnv("NODE_ENV", "production");
    const {
      FIREBASE_AUTH_EMULATOR_HOST,
      FIRESTORE_EMULATOR_HOST,
      NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST,
      ...prod
    } = validEnv;
    void FIREBASE_AUTH_EMULATOR_HOST;
    void FIRESTORE_EMULATOR_HOST;
    void NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
    expect(envSchema.safeParse(prod).success).toBe(true);
  });

  describe("mergeEnvSource local defaults", () => {
    it("fills blanks outside production so bare pnpm dev can start", () => {
      vi.stubEnv("NODE_ENV", "development");
      const merged = mergeEnvSource({});
      expect(merged.APP_URL).toBe("http://localhost:3000");
      expect(merged.STRIPE_SECRET_KEY).toBe("sk_test_replaceme");
      expect(merged.FIREBASE_AUTH_EMULATOR_HOST).toBe("127.0.0.1:9099");
      expect(merged.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST).toBe("127.0.0.1:9099");
      expect(parseEnv(merged).FIREBASE_PROJECT_ID).toBe("demo-prosefield");
    });

    it("does not apply defaults in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      const merged = mergeEnvSource({});
      expect(merged.APP_URL).toBeUndefined();
    });

    it("writes defaults into process.env for Admin SDK / NEXT_PUBLIC consumers", () => {
      vi.stubEnv("NODE_ENV", "development");
      const target: Record<string, string | undefined> = {
        // Whitespace-only counts as blank and is replaced.
        APP_URL: "   ",
      };
      applyLocalDevDefaultsToProcessEnv(target as NodeJS.ProcessEnv);
      expect(target.FIREBASE_AUTH_EMULATOR_HOST).toBe("127.0.0.1:9099");
      expect(target.FIRESTORE_EMULATOR_HOST).toBe("127.0.0.1:8080");
      expect(target.NEXT_PUBLIC_FIREBASE_API_KEY).toBe("demo-api-key");
      expect(target.APP_URL).toBe("http://localhost:3000");
    });


    it("does not mutate process.env defaults in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      const target: Record<string, string | undefined> = {};
      applyLocalDevDefaultsToProcessEnv(target as NodeJS.ProcessEnv);
      expect(target.FIREBASE_AUTH_EMULATOR_HOST).toBeUndefined();
    });
  });
});
