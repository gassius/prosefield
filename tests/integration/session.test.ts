/**
 * Integration tests against Docker-backed Auth + Firestore emulators.
 * Refuse to run without emulator hosts (architecture §9 / §13).
 */
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

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
process.env.STRIPE_SECRET_KEY ??= "sk_test_replaceme";
process.env.STRIPE_WEBHOOK_SECRET ??= "whsec_replaceme";
process.env.STRIPE_PRICE_ID ??= "price_replaceme";
process.env.PLAN_DISPLAY_NAME ??= "Prosefield";
process.env.PLAN_DISPLAY_PRICE ??= "8";
process.env.PLAN_DISPLAY_CURRENCY ??= "EUR";
process.env.PLAN_DISPLAY_INTERVAL ??= "month";
process.env.FEATURE_CUSTOMER_PORTAL ??= "false";

async function signUp(
  email: string,
  password: string,
): Promise<{ idToken: string; localId: string }> {
  const response = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`signUp failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as { idToken: string; localId: string };
}

describe("session exchange (emulators)", () => {
  beforeAll(async () => {
    await import("@/lib/firebase/admin");
  });

  it("creates a session cookie for a recent ID token and upserts users/{uid}", async () => {
    const {
      createSessionCookieFromIdToken,
      verifySessionCookieValue,
      revokeUserSessions,
      SessionError,
    } = await import("@/features/auth/session");
    const { upsertUserDocument, getUserDocument } = await import(
      "@/features/auth/users"
    );
    const { requireActiveSubscription } = await import(
      "@/features/auth/guards"
    );

    const email = `user-${randomUUID()}@example.com`;
    const { idToken, localId } = await signUp(email, "password-123");

    const { sessionCookie, decoded } =
      await createSessionCookieFromIdToken(idToken);
    expect(decoded.uid).toBe(localId);
    expect(decoded.email).toBe(email);

    await upsertUserDocument({ uid: localId, email });
    await upsertUserDocument({ uid: localId, email });

    const user = await getUserDocument(localId);
    expect(user?.email).toBe(email);
    expect(user?.stripeCustomerId).toBeNull();

    const verified = await verifySessionCookieValue(sessionCookie, false);
    expect(verified.uid).toBe(localId);

    await expect(requireActiveSubscription(localId)).rejects.toBeInstanceOf(
      SessionError,
    );

    const { getAdminFirestore } = await import("@/lib/firebase/admin");
    await getAdminFirestore().collection("subscriptions").doc(localId).set({
      status: "active",
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
      stripePriceId: "price_test",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      updatedAt: new Date(),
      lastEventId: "evt_test",
    });

    await expect(requireActiveSubscription(localId)).resolves.toBeUndefined();

    // revokeRefreshTokens sets validSince = floor(now/1000). The revoked check
    // is auth_time*1000 < validSince, so both must fall in different seconds.
    const waitMs = Math.max(0, (decoded.auth_time + 1) * 1000 - Date.now() + 50);
    if (waitMs > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, waitMs);
      });
    }
    await revokeUserSessions(localId);
    await expect(verifySessionCookieValue(sessionCookie, true)).rejects.toMatchObject({
      code: "auth/session-cookie-revoked",
    });
  });

  it("rejects CSRF and Origin failures on POST /api/session", async () => {
    const { POST } = await import("@/app/api/session/route");
    const email = `csrf-${randomUUID()}@example.com`;
    const { idToken } = await signUp(email, "password-123");

    const badOrigin = await POST(
      new Request("http://localhost:3000/api/session", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
          "content-type": "application/json",
          cookie: "csrf_token=abc",
          "x-csrf-token": "abc",
        },
        body: JSON.stringify({ idToken }),
      }),
    );
    expect(badOrigin.status).toBe(403);

    const badCsrf = await POST(
      new Request("http://localhost:3000/api/session", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          cookie: "csrf_token=abc",
          "x-csrf-token": "xyz",
        },
        body: JSON.stringify({ idToken }),
      }),
    );
    expect(badCsrf.status).toBe(403);
  });
});
