import { afterEach, describe, expect, it, vi } from "vitest";
import { localDevDefaults } from "@/lib/env";
import {
  FAKE_STRIPE_PRICE_ID,
  FAKE_STRIPE_SECRET_KEY,
  FAKE_STRIPE_WEBHOOK_SECRET,
} from "../fixtures/stripe";


describe("isBillingConfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is false for placeholder local defaults", async () => {
    const { isBillingConfigured } = await import(
      "@/features/billing/configured"
    );
    expect(
      isBillingConfigured({
        ...localDevDefaults,
        FEATURE_CUSTOMER_PORTAL: false,
        NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
        FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
        FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      } as never),
    ).toBe(false);
  });

  it("is true for non-placeholder test credentials", async () => {
    const { isBillingConfigured } = await import(
      "@/features/billing/configured"
    );
    expect(
      isBillingConfigured({
        ...localDevDefaults,
        STRIPE_SECRET_KEY: FAKE_STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET: FAKE_STRIPE_WEBHOOK_SECRET,
        STRIPE_PRICE_ID: FAKE_STRIPE_PRICE_ID,
        FEATURE_CUSTOMER_PORTAL: false,
      } as never),
    ).toBe(true);
  });

  it("rejects keys that still contain replaceme", async () => {
    const { isBillingConfigured } = await import(
      "@/features/billing/configured"
    );
    expect(
      isBillingConfigured({
        ...localDevDefaults,
        STRIPE_SECRET_KEY: ["sk", "test", "not", "replaceme", "yet"].join("_"),
        STRIPE_WEBHOOK_SECRET: ["whsec", "ok"].join("_"),
        STRIPE_PRICE_ID: ["price", "ok"].join("_"),
        FEATURE_CUSTOMER_PORTAL: false,
      } as never),
    ).toBe(false);
  });
});
