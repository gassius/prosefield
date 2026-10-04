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
  DOCUMENT_ENCRYPTION_PROVIDER: "dev",
  DOCUMENT_ENCRYPTION_KEY_VERSION: "1",
  DOCUMENT_ENCRYPTION_KEK: Buffer.alloc(32, 0x07).toString("base64"),
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
    expect(env.DOCUMENT_ENCRYPTION_PROVIDER).toBe("dev");
    expect(env.DOCUMENT_ENCRYPTION_KEY_VERSION).toBe(1);
  });

  it("rejects non-local http APP_URL", () => {
    const result = envSchema.safeParse({
      ...validEnv,
      APP_URL: "http://evil.example",
    });
    expect(result.success).toBe(false);
  });

  it("requires KEK for dev provider and KMS name for kms provider", () => {
    expect(
      envSchema.safeParse({
        ...validEnv,
        DOCUMENT_ENCRYPTION_KEK: undefined,
      }).success,
    ).toBe(false);
    expect(
      envSchema.safeParse({
        ...validEnv,
        DOCUMENT_ENCRYPTION_PROVIDER: "kms",
        DOCUMENT_ENCRYPTION_KEK: undefined,
        GCP_KMS_KEY_NAME: "projects/p/locations/l/keyRings/r/cryptoKeys/k",
      }).success,
    ).toBe(true);
    expect(
      envSchema.safeParse({
        ...validEnv,
        DOCUMENT_ENCRYPTION_PROVIDER: "kms",
        GCP_KMS_KEY_NAME: undefined,
      }).success,
    ).toBe(false);
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

  it("accepts production config without emulator hosts when using kms", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_EMULATORS", "");
    const {
      FIREBASE_AUTH_EMULATOR_HOST,
      FIRESTORE_EMULATOR_HOST,
      NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST,
      DOCUMENT_ENCRYPTION_KEK,
      ...rest
    } = validEnv;
    void FIREBASE_AUTH_EMULATOR_HOST;
    void FIRESTORE_EMULATOR_HOST;
    void NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
    void DOCUMENT_ENCRYPTION_KEK;
    const prod = {
      ...rest,
      APP_URL: "https://app.example",
      DOCUMENT_ENCRYPTION_PROVIDER: "kms",
      GCP_KMS_KEY_NAME: "projects/p/locations/l/keyRings/r/cryptoKeys/k",
    };
    expect(envSchema.safeParse(prod).success).toBe(true);
  });

  it("rejects dev provider and known filler KEK in production (P4)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_EMULATORS", "");
    const {
      FIREBASE_AUTH_EMULATOR_HOST,
      FIRESTORE_EMULATOR_HOST,
      NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST,
      ...prodBase
    } = validEnv;
    void FIREBASE_AUTH_EMULATOR_HOST;
    void FIRESTORE_EMULATOR_HOST;
    void NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
    const result = envSchema.safeParse({
      ...prodBase,
      APP_URL: "https://app.example",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          String(issue.message).includes("dev is not allowed"),
        ),
      ).toBe(true);
    }
  });

  it("rejects wrong-length KEK at env parse (P5/K1)", () => {
    const short = envSchema.safeParse({
      ...validEnv,
      DOCUMENT_ENCRYPTION_KEK: "short",
    });
    expect(short.success).toBe(false);
    if (!short.success) {
      expect(
        short.error.issues.some((issue) =>
          String(issue.message).includes("32 bytes"),
        ),
      ).toBe(true);
    }
  });

  it("rejects key versions above uint32 max and non-integers (B2i/MF5)", () => {
    const aboveMax = envSchema.safeParse({
      ...validEnv,
      DOCUMENT_ENCRYPTION_KEY_VERSION: "4294967296", // 2^32
    });
    expect(aboveMax.success).toBe(false);

    const aliasRisk = envSchema.safeParse({
      ...validEnv,
      DOCUMENT_ENCRYPTION_KEY_VERSION: "4294967297", // 2^32+1
    });
    expect(aliasRisk.success).toBe(false);

    const nonInt = envSchema.safeParse({
      ...validEnv,
      DOCUMENT_ENCRYPTION_KEY_VERSION: "1.5",
    });
    expect(nonInt.success).toBe(false);

    const okMax = envSchema.safeParse({
      ...validEnv,
      DOCUMENT_ENCRYPTION_KEY_VERSION: "4294967295", // 2^32-1
    });
    expect(okMax.success).toBe(true);
  });

  it("rejects non-canonical / URL-safe KEK base64 (env.ts canonical check)", () => {
    // 32 raw bytes → standard base64 is padded; base64url drops padding / uses -_.
    const urlSafe = Buffer.alloc(32, 0xcd).toString("base64url");
    expect(urlSafe).not.toBe(Buffer.alloc(32, 0xcd).toString("base64"));

    const kek = envSchema.safeParse({
      ...validEnv,
      DOCUMENT_ENCRYPTION_KEK: urlSafe,
    });
    expect(kek.success).toBe(false);
    if (!kek.success) {
      expect(
        kek.error.issues.some((issue) =>
          String(issue.message).includes("canonical"),
        ),
      ).toBe(true);
    }

    const previous = envSchema.safeParse({
      ...validEnv,
      DOCUMENT_ENCRYPTION_KEK_PREVIOUS: urlSafe,
    });
    expect(previous.success).toBe(false);
    if (!previous.success) {
      expect(
        previous.error.issues.some((issue) =>
          String(issue.message).includes("canonical"),
        ),
      ).toBe(true);
    }
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
