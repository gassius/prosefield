/**
 * Document guard-chain + CRUD against Docker Auth/Firestore emulators.
 */
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { __resetCookieStore } from "../mocks/next-headers";
import { EMPTY_DOCUMENT_CONTENT } from "@/features/documents/schemas";

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

async function establishSession(email: string) {
  const { createSessionCookieFromIdToken, setSessionCookie } = await import(
    "@/features/auth/session"
  );
  const { upsertUserDocument } = await import("@/features/auth/users");
  const { idToken, localId } = await signUp(email, "password-123");
  const { sessionCookie } = await createSessionCookieFromIdToken(idToken);
  await upsertUserDocument({ uid: localId, email });
  await setSessionCookie(sessionCookie);
  return localId;
}

async function seedActiveSubscription(uid: string) {
  const { getAdminFirestore } = await import("@/lib/firebase/admin");
  await getAdminFirestore().collection("subscriptions").doc(uid).set({
    status: "active",
    stripeCustomerId: "cus_docs",
    stripeSubscriptionId: "sub_docs",
    stripePriceId: "price_docs",
    cancelAtPeriodEnd: false,
    lastEventId: "evt_docs",
  });
}

describe("documents guard chain (emulators)", () => {
  beforeAll(async () => {
    const { __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    await import("@/lib/firebase/admin");
  });

  beforeEach(() => {
    __resetCookieStore();
  });

  it("rejects create with no session", async () => {
    const { createDocumentAction } = await import(
      "@/features/documents/actions"
    );
    const result = await createDocumentAction({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("unauthorized");
    }
  });

  it("rejects mutations when subscription is inactive", async () => {
    const email = `docs-inactive-${randomUUID()}@example.com`;
    await establishSession(email);
    // No subscription projection → inactive.

    const {
      createDocumentAction,
      saveDocumentAction,
      renameDocumentAction,
      deleteDocumentAction,
    } = await import("@/features/documents/actions");

    for (const result of [
      await createDocumentAction({}),
      await saveDocumentAction({
        documentId: "missing",
        content: EMPTY_DOCUMENT_CONTENT,
      }),
      await renameDocumentAction({ documentId: "missing", title: "X" }),
      await deleteDocumentAction({ documentId: "missing" }),
    ]) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("forbidden");
      }
    }
  });

  it("returns not_found for nonexistent and non-owned documents", async () => {
    const ownerEmail = `docs-owner-${randomUUID()}@example.com`;
    const ownerUid = await establishSession(ownerEmail);
    await seedActiveSubscription(ownerUid);

    const { createDocumentAction, saveDocumentAction, renameDocumentAction } =
      await import("@/features/documents/actions");

    const created = await createDocumentAction({ title: "Owner doc" });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const missing = await saveDocumentAction({
      documentId: "does-not-exist",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.code).toBe("not_found");
    }

    // Switch to another entitled user.
    __resetCookieStore();
    const otherEmail = `docs-other-${randomUUID()}@example.com`;
    const otherUid = await establishSession(otherEmail);
    await seedActiveSubscription(otherUid);

    const foreign = await renameDocumentAction({
      documentId: created.data.id,
      title: "Hijack",
    });
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) {
      expect(foreign.code).toBe("not_found");
    }
  });

  it("rejects invalid input (empty title, oversize content)", async () => {
    const email = `docs-invalid-${randomUUID()}@example.com`;
    const uid = await establishSession(email);
    await seedActiveSubscription(uid);

    const { createDocumentAction, renameDocumentAction, saveDocumentAction } =
      await import("@/features/documents/actions");

    const created = await createDocumentAction({});
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const emptyTitle = await renameDocumentAction({
      documentId: created.data.id,
      title: "   ",
    });
    expect(emptyTitle.ok).toBe(false);
    if (!emptyTitle.ok) {
      expect(emptyTitle.code).toBe("invalid");
    }

    const oversized = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x".repeat(512 * 1024) }],
        },
      ],
    };
    const big = await saveDocumentAction({
      documentId: created.data.id,
      content: oversized,
    });
    expect(big.ok).toBe(false);
    if (!big.ok) {
      expect(big.code).toBe("invalid");
    }
  });

  it("subscriber CRUD persists content and title", async () => {
    const email = `docs-crud-${randomUUID()}@example.com`;
    const uid = await establishSession(email);
    await seedActiveSubscription(uid);

    const {
      createDocumentAction,
      saveDocumentAction,
      renameDocumentAction,
      deleteDocumentAction,
    } = await import("@/features/documents/actions");
    const { getDocumentById, listDocumentsForOwner } = await import(
      "@/features/documents/repository"
    );

    const created = await createDocumentAction({ title: "Draft one" });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello field" }],
        },
      ],
    };
    const saved = await saveDocumentAction({
      documentId: created.data.id,
      content,
    });
    expect(saved.ok).toBe(true);

    const renamed = await renameDocumentAction({
      documentId: created.data.id,
      title: "Draft two",
    });
    expect(renamed.ok).toBe(true);

    const loaded = await getDocumentById(created.data.id);
    expect(loaded?.title).toBe("Draft two");
    expect(JSON.stringify(loaded?.content)).toContain("Hello field");
    expect(loaded?.ownerId).toBe(uid);

    const list = await listDocumentsForOwner(uid);
    expect(list.some((item) => item.id === created.data.id)).toBe(true);

    const deleted = await deleteDocumentAction({ documentId: created.data.id });
    expect(deleted.ok).toBe(true);
    expect(await getDocumentById(created.data.id)).toBeNull();
  });
});
