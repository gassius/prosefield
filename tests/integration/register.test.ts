/**
 * Server-side registerAction against Docker Auth emulator.
 * Bites if the 8-char minimum is removed from the server entry point.
 */
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  PLACEHOLDER_STRIPE_PRICE_ID,
  PLACEHOLDER_STRIPE_SECRET_KEY,
  PLACEHOLDER_STRIPE_WEBHOOK_SECRET,
} from "../fixtures/stripe";

const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;

if (!authHost || !firestoreHost) {
  throw new Error(
    "Integration tests require FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST (start with `pnpm backend:up`).",
  );
}

process.env.FIREBASE_PROJECT_ID ??= "demo-prosefield";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??= "demo-prosefield";
process.env.APP_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??= "demo-api-key";
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??=
  "demo-prosefield.firebaseapp.com";
process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??=
  "1:000000000000:web:0000000000000000000000";
process.env.STRIPE_SECRET_KEY ??= PLACEHOLDER_STRIPE_SECRET_KEY;
process.env.STRIPE_WEBHOOK_SECRET ??= PLACEHOLDER_STRIPE_WEBHOOK_SECRET;
process.env.STRIPE_PRICE_ID ??= PLACEHOLDER_STRIPE_PRICE_ID;
process.env.PLAN_DISPLAY_NAME ??= "Prosefield";
process.env.PLAN_DISPLAY_PRICE ??= "8";
process.env.PLAN_DISPLAY_CURRENCY ??= "EUR";
process.env.PLAN_DISPLAY_INTERVAL ??= "month";
process.env.FEATURE_CUSTOMER_PORTAL ??= "false";

describe("registerAction (emulators)", () => {
  beforeAll(async () => {
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    await import("@/lib/firebase/admin");
  });

  it("rejects a 7-character password at the server entry point", async () => {
    const { registerAction } = await import("@/features/auth/register");
    const { siteCopy } = await import("@/content/site");
    const short = "abcdefg";
    expect(short).toHaveLength(7);

    const result = await registerAction({
      email: `short-${randomUUID()}@example.com`,
      password: short,
    });

    expect(result).toEqual({
      ok: false,
      field: "password",
      message: siteCopy.auth.passwordHint,
    });
  });

  it("rejects 123456 and creates no Auth user", async () => {
    const { registerAction } = await import("@/features/auth/register");
    const { getAdminAuth } = await import("@/lib/firebase/admin");
    const { siteCopy } = await import("@/content/site");
    const email = `six-char-${randomUUID()}@example.com`;
    const short = "123456";
    expect(short).toHaveLength(6);

    const result = await registerAction({ email, password: short });
    expect(result).toEqual({
      ok: false,
      field: "password",
      message: siteCopy.auth.passwordHint,
    });

    await expect(getAdminAuth().getUserByEmail(email)).rejects.toMatchObject({
      code: "auth/user-not-found",
    });
  });

  it("accepts an 8-character password and stamps pf_pw on the Auth user", async () => {
    const { registerAction } = await import("@/features/auth/register");
    const { getAdminAuth } = await import("@/lib/firebase/admin");
    const {
      PASSWORD_POLICY_CLAIM,
      PASSWORD_POLICY_CLAIM_VALUE,
    } = await import("@/features/auth/constants");
    const email = `ok-${randomUUID()}@example.com`;
    const password = "abcdefgh";
    expect(password).toHaveLength(8);

    const result = await registerAction({ email, password });
    expect(result).toEqual({ ok: true });

    const user = await getAdminAuth().getUserByEmail(email);
    expect(user.email).toBe(email);
    expect(user.customClaims?.[PASSWORD_POLICY_CLAIM]).toBe(
      PASSWORD_POLICY_CLAIM_VALUE,
    );
  });
});
