/**
 * Integration tests against Docker-backed Auth + Firestore emulators.
 * Refuse to run without emulator hosts (architecture §9 / §13).
 */
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { __getCookieRecord, __resetCookieStore } from "../mocks/next-headers";
import {
  PASSWORD_POLICY_CLAIM,
  PASSWORD_POLICY_CLAIM_VALUE,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRES_IN_MS,
} from "@/features/auth/constants";
import {
  registerAndSignIn,
  signUpViaIdentityToolkit,
} from "./helpers/emulator-auth";

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

describe("session exchange (emulators)", () => {
  beforeAll(async () => {
    await import("@/lib/firebase/admin");
  });

  beforeEach(() => {
    __resetCookieStore();
  });

  it("creates a session cookie for a recent ID token and upserts users/{uid}", async () => {
    const {
      createSessionCookieFromIdToken,
      verifySessionCookieValue,
      revokeUserSessions,
      SessionError,
      setSessionCookie,
      readSessionCookie,
      clearSessionCookie,
      getOptionalSession,
    } = await import("@/features/auth/session");
    const { upsertUserDocument, getUserDocument } = await import(
      "@/features/auth/users"
    );
    const {
      requireActiveSubscription,
      getAccountState,
      requireSession,
    } = await import("@/features/auth/guards");

    const email = `user-${randomUUID()}@example.com`;
    const { idToken, localId } = await registerAndSignIn(email, "password-123");

    const { sessionCookie, decoded } =
      await createSessionCookieFromIdToken(idToken);
    expect(decoded.uid).toBe(localId);
    expect(decoded.email).toBe(email);
    expect(decoded[PASSWORD_POLICY_CLAIM]).toBe(PASSWORD_POLICY_CLAIM_VALUE);

    await upsertUserDocument({ uid: localId, email });
    await upsertUserDocument({ uid: localId, email });

    const user = await getUserDocument(localId);
    expect(user?.email).toBe(email);
    expect(user?.stripeCustomerId).toBeNull();

    const verified = await verifySessionCookieValue(sessionCookie, false);
    expect(verified.uid).toBe(localId);

    await setSessionCookie(sessionCookie);
    expect(await readSessionCookie()).toBe(sessionCookie);
    const optional = await getOptionalSession(false);
    expect(optional?.uid).toBe(localId);
    await expect(requireSession()).resolves.toMatchObject({ uid: localId });

    const loggedIn = await getAccountState();
    expect(loggedIn).toMatchObject({
      kind: "logged_in",
      uid: localId,
      email,
      subscriptionActive: false,
    });

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
    const subscriber = await getAccountState();
    expect(subscriber).toMatchObject({
      kind: "subscriber",
      uid: localId,
      subscriptionActive: true,
    });

    await clearSessionCookie();
    expect(await readSessionCookie()).toBe("");
    expect(await getOptionalSession(false)).toBeNull();
    await expect(requireSession()).rejects.toBeInstanceOf(SessionError);
    expect(await getAccountState()).toEqual({ kind: "logged_out" });

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

  it("rejects accounts:signUp short-password tokens on POST /api/session (no users/{uid})", async () => {
    const { POST } = await import("@/app/api/session/route");
    const { getUserDocument } = await import("@/features/auth/users");

    const email = `bypass-${randomUUID()}@example.com`;
    const short = "abcdef";
    expect(short).toHaveLength(6);
    const { idToken, localId } = await signUpViaIdentityToolkit(email, short);

    const response = await POST(
      new Request("http://localhost:3000/api/session", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          cookie: "csrf_token=tok",
          "x-csrf-token": "tok",
        },
        body: JSON.stringify({ idToken }),
      }),
    );
    expect(response.status).toBe(401);
    expect(__getCookieRecord(SESSION_COOKIE_NAME)).toBeUndefined();
    expect(await getUserDocument(localId)).toBeNull();
  });

  it("accepts registerAction users on POST /api/session", async () => {
    const { POST } = await import("@/app/api/session/route");
    const { getUserDocument } = await import("@/features/auth/users");

    const email = `reg-${randomUUID()}@example.com`;
    const { idToken, localId } = await registerAndSignIn(email, "password-123");

    const response = await POST(
      new Request("http://localhost:3000/api/session", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          cookie: "csrf_token=tok",
          "x-csrf-token": "tok",
        },
        body: JSON.stringify({ idToken }),
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; uid: string };
    expect(body.ok).toBe(true);
    expect(body.uid).toBe(localId);
    expect(await getUserDocument(localId)).toMatchObject({ email });
  });

  it("treats firestore outages as not subscribed (marketing still renders)", async () => {
    const {
      createSessionCookieFromIdToken,
      setSessionCookie,
      SessionError,
    } = await import("@/features/auth/session");
    const { getAccountState, requireActiveSubscription } = await import(
      "@/features/auth/guards"
    );
    const admin = await import("@/lib/firebase/admin");

    const email = `down-${randomUUID()}@example.com`;
    const { idToken, localId } = await registerAndSignIn(email, "password-123");
    const { sessionCookie } = await createSessionCookieFromIdToken(idToken);
    await setSessionCookie(sessionCookie);

    // Seed an active subscription first so the outage path is the only reason
    // subscriptionActive becomes false (would be subscriber without the spy).
    await admin
      .getAdminFirestore()
      .collection("subscriptions")
      .doc(localId)
      .set({
        status: "active",
        stripeCustomerId: "cus_outage",
        stripeSubscriptionId: "sub_outage",
        stripePriceId: "price_test",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
        lastEventId: "evt_outage",
      });

    expect(await getAccountState()).toMatchObject({
      kind: "subscriber",
      uid: localId,
      subscriptionActive: true,
    });

    const spy = vi.spyOn(admin, "getAdminFirestore").mockImplementation(() => {
      throw new Error("emulator down");
    });

    try {
      expect(await getAccountState()).toMatchObject({
        kind: "logged_in",
        uid: localId,
        subscriptionActive: false,
      });
      await expect(requireActiveSubscription(localId)).rejects.toBeInstanceOf(
        SessionError,
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("returns null for missing users/{uid}", async () => {
    const { getUserDocument } = await import("@/features/auth/users");
    expect(await getUserDocument(`missing-${randomUUID()}`)).toBeNull();
  });

  it("rejects CSRF and Origin failures on POST /api/session", async () => {
    const { POST } = await import("@/app/api/session/route");
    const email = `csrf-${randomUUID()}@example.com`;
    const { idToken } = await registerAndSignIn(email, "password-123");

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

    const missingOrigin = await POST(
      new Request("http://localhost:3000/api/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "csrf_token=abc",
          "x-csrf-token": "abc",
        },
        body: JSON.stringify({ idToken }),
      }),
    );
    expect(missingOrigin.status).toBe(403);

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

  it("exchanges a valid session via POST with cookie attributes and clears via DELETE", async () => {
    const { POST, DELETE } = await import("@/app/api/session/route");
    const email = `api-${randomUUID()}@example.com`;
    const { idToken } = await registerAndSignIn(email, "password-123");

    const created = await POST(
      new Request("http://localhost:3000/api/session", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          cookie: "csrf_token=tok",
          "x-csrf-token": "tok",
        },
        body: JSON.stringify({ idToken }),
      }),
    );
    expect(created.status).toBe(200);
    const body = (await created.json()) as { ok: boolean; email: string };
    expect(body.ok).toBe(true);
    expect(body.email).toBe(email);

    const cookie = __getCookieRecord(SESSION_COOKIE_NAME);
    expect(cookie).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
      maxAge: SESSION_EXPIRES_IN_MS / 1000,
    });
    expect(cookie?.value).toBeTruthy();

    const cleared = await DELETE(
      new Request("http://localhost:3000/api/session", {
        method: "DELETE",
        headers: {
          origin: "http://localhost:3000",
          cookie: "csrf_token=tok",
          "x-csrf-token": "tok",
        },
      }),
    );
    expect(cleared.status).toBe(200);
    expect(__getCookieRecord(SESSION_COOKIE_NAME)?.value).toBe("");
    expect(__getCookieRecord(SESSION_COOKIE_NAME)?.maxAge).toBe(0);
  });

  it("rejects DELETE with bad Origin or CSRF", async () => {
    const { DELETE } = await import("@/app/api/session/route");

    const badOrigin = await DELETE(
      new Request("http://localhost:3000/api/session", {
        method: "DELETE",
        headers: {
          origin: "https://evil.example",
          cookie: "csrf_token=tok",
          "x-csrf-token": "tok",
        },
      }),
    );
    expect(badOrigin.status).toBe(403);

    const badCsrf = await DELETE(
      new Request("http://localhost:3000/api/session", {
        method: "DELETE",
        headers: {
          origin: "http://localhost:3000",
          cookie: "csrf_token=abc",
          "x-csrf-token": "xyz",
        },
      }),
    );
    expect(badCsrf.status).toBe(403);
  });

  it("rejects stale auth_time and invalid ID tokens on POST", async () => {
    const { POST } = await import("@/app/api/session/route");
    const { createSessionCookieFromIdToken, SessionError } = await import(
      "@/features/auth/session"
    );

    const forged = await POST(
      new Request("http://localhost:3000/api/session", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          cookie: "csrf_token=tok",
          "x-csrf-token": "tok",
        },
        body: JSON.stringify({ idToken: "not-a-real-token" }),
      }),
    );
    expect(forged.status).toBe(401);

    const email = `stale-${randomUUID()}@example.com`;
    const { idToken } = await registerAndSignIn(email, "password-123");
    // Mint once so we know the token is otherwise valid, then force stale auth_time
    // via a mocked clock on isRecentAuthTime path — createSessionCookieFromIdToken
    // rejects when auth_time is older than the recent window.
    const auth = await import("@/lib/firebase/admin");
    const decoded = await auth.getAdminAuth().verifyIdToken(idToken);
    // Overwrite auth_time far in the past by verifying through a spy.
    const verifySpy = vi
      .spyOn(auth.getAdminAuth(), "verifyIdToken")
      .mockResolvedValue({
        ...decoded,
        auth_time: 1,
      } as never);

    try {
      await expect(createSessionCookieFromIdToken(idToken)).rejects.toMatchObject({
        code: "recent_auth_required",
      });
      await expect(createSessionCookieFromIdToken(idToken)).rejects.toBeInstanceOf(
        SessionError,
      );

      const stalePost = await POST(
        new Request("http://localhost:3000/api/session", {
          method: "POST",
          headers: {
            origin: "http://localhost:3000",
            "content-type": "application/json",
            cookie: "csrf_token=tok",
            "x-csrf-token": "tok",
          },
          body: JSON.stringify({ idToken }),
        }),
      );
      expect(stalePost.status).toBe(401);
      const staleBody = (await stalePost.json()) as { code?: string };
      expect(staleBody.code).toBe("recent_auth_required");
    } finally {
      verifySpy.mockRestore();
    }
  });

  it("exercises page guards with a real session cookie", async () => {
    const {
      createSessionCookieFromIdToken,
      setSessionCookie,
      clearSessionCookie,
      SessionError,
    } = await import("@/features/auth/session");
    const { requireSession, requireSessionOrRedirect, getAccountState } =
      await import("@/features/auth/guards");

    const email = `guard-${randomUUID()}@example.com`;
    const { idToken, localId } = await registerAndSignIn(email, "password-123");
    const { sessionCookie } = await createSessionCookieFromIdToken(idToken);

    await setSessionCookie(sessionCookie);
    await expect(requireSession()).resolves.toMatchObject({ uid: localId });
    await expect(requireSessionOrRedirect("/login")).resolves.toMatchObject({
      uid: localId,
    });
    expect(await getAccountState()).toMatchObject({
      kind: "logged_in",
      uid: localId,
    });

    await clearSessionCookie();
    await expect(requireSession()).rejects.toBeInstanceOf(SessionError);
  });
});
