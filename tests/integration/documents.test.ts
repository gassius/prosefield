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
  return { localId, idToken };
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

  it("no session + invalid input → unauthorized (session before Zod)", async () => {
    const { saveDocumentAction } = await import("@/features/documents/actions");
    const result = await saveDocumentAction({
      documentId: "not-valid!!",
      content: { type: "codeBlock" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("unauthorized");
    }
  });

  it("rejects mutations when subscription is inactive", async () => {
    const email = `docs-inactive-${randomUUID()}@example.com`;
    await establishSession(email);

    const {
      createDocumentAction,
      saveDocumentAction,
      renameDocumentAction,
      deleteDocumentAction,
    } = await import("@/features/documents/actions");

    for (const result of [
      await createDocumentAction({}),
      await saveDocumentAction({
        documentId: "abcABC1234567890wxyz",
        content: EMPTY_DOCUMENT_CONTENT,
      }),
      await renameDocumentAction({
        documentId: "abcABC1234567890wxyz",
        title: "X",
      }),
      await deleteDocumentAction({ documentId: "abcABC1234567890wxyz" }),
    ]) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("forbidden");
      }
    }
  });

  it("inactive subscription + foreign doc → forbidden (subscription before owner)", async () => {
    const ownerEmail = `docs-own-${randomUUID()}@example.com`;
    const { localId: ownerUid } = await establishSession(ownerEmail);
    await seedActiveSubscription(ownerUid);
    const { createDocumentAction } = await import(
      "@/features/documents/actions"
    );
    const created = await createDocumentAction({ title: "Owned" });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    __resetCookieStore();
    const otherEmail = `docs-idle-${randomUUID()}@example.com`;
    await establishSession(otherEmail);
    // no active subscription

    const { saveDocumentAction, deleteDocumentAction } = await import(
      "@/features/documents/actions"
    );
    const save = await saveDocumentAction({
      documentId: created.data.id,
      content: EMPTY_DOCUMENT_CONTENT,
    });
    expect(save.ok).toBe(false);
    if (!save.ok) {
      expect(save.code).toBe("forbidden");
    }
    const del = await deleteDocumentAction({ documentId: created.data.id });
    expect(del.ok).toBe(false);
    if (!del.ok) {
      expect(del.code).toBe("forbidden");
    }
  });

  it("revoked session cannot mutate documents", async () => {
    const email = `docs-revoked-${randomUUID()}@example.com`;
    const { localId, idToken } = await establishSession(email);
    await seedActiveSubscription(localId);

    const { revokeUserSessions, verifySessionCookieValue, createSessionCookieFromIdToken } =
      await import("@/features/auth/session");
    const { sessionCookie, decoded } =
      await createSessionCookieFromIdToken(idToken);
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

    const { createDocumentAction, saveDocumentAction } = await import(
      "@/features/documents/actions"
    );
    const create = await createDocumentAction({});
    expect(create.ok).toBe(false);
    if (!create.ok) {
      expect(create.code).toBe("unauthorized");
    }
    const save = await saveDocumentAction({
      documentId: "abcABC1234567890wxyz",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    expect(save.ok).toBe(false);
    if (!save.ok) {
      expect(save.code).toBe("unauthorized");
    }
  });

  it("foreign save, rename, and delete → not_found; owner doc unchanged", async () => {
    const ownerEmail = `docs-owner-${randomUUID()}@example.com`;
    const { localId: ownerUid } = await establishSession(ownerEmail);
    await seedActiveSubscription(ownerUid);

    const {
      createDocumentAction,
      saveDocumentAction,
      renameDocumentAction,
      deleteDocumentAction,
    } = await import("@/features/documents/actions");
    const { getDocumentById } = await import(
      "@/features/documents/repository"
    );

    const created = await createDocumentAction({ title: "Owner doc" });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const original = await getDocumentById(created.data.id);
    expect(original?.title).toBe("Owner doc");

    __resetCookieStore();
    const otherEmail = `docs-other-${randomUUID()}@example.com`;
    const { localId: otherUid } = await establishSession(otherEmail);
    await seedActiveSubscription(otherUid);

    const foreignSave = await saveDocumentAction({
      documentId: created.data.id,
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "hijacked" }],
          },
        ],
      },
    });
    expect(foreignSave.ok).toBe(false);
    if (!foreignSave.ok) {
      expect(foreignSave.code).toBe("not_found");
    }

    const foreignRename = await renameDocumentAction({
      documentId: created.data.id,
      title: "Stolen title",
    });
    expect(foreignRename.ok).toBe(false);
    if (!foreignRename.ok) {
      expect(foreignRename.code).toBe("not_found");
    }

    const foreignDelete = await deleteDocumentAction({
      documentId: created.data.id,
    });
    expect(foreignDelete.ok).toBe(false);
    if (!foreignDelete.ok) {
      expect(foreignDelete.code).toBe("not_found");
    }

    const stillThere = await getDocumentById(created.data.id);
    expect(stillThere?.title).toBe("Owner doc");
    expect(stillThere?.ownerId).toBe(ownerUid);
    expect(JSON.stringify(stillThere?.content)).not.toContain("hijacked");
  });

  it("foreign doc + invalid body → not_found (owner before Zod)", async () => {
    const ownerEmail = `docs-order-own-${randomUUID()}@example.com`;
    const { localId: ownerUid } = await establishSession(ownerEmail);
    await seedActiveSubscription(ownerUid);

    const { createDocumentAction, saveDocumentAction, renameDocumentAction } =
      await import("@/features/documents/actions");
    const created = await createDocumentAction({ title: "Keep me" });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    __resetCookieStore();
    const otherEmail = `docs-order-other-${randomUUID()}@example.com`;
    const { localId: otherUid } = await establishSession(otherEmail);
    await seedActiveSubscription(otherUid);

    const rename = await renameDocumentAction({
      documentId: created.data.id,
      title: "",
    });
    expect(rename.ok).toBe(false);
    if (!rename.ok) {
      expect(rename.code).toBe("not_found");
    }

    const save = await saveDocumentAction({
      documentId: created.data.id,
      content: { type: "codeBlock", content: [] },
    });
    expect(save.ok).toBe(false);
    if (!save.ok) {
      expect(save.code).toBe("not_found");
    }

    const { getDocumentById } = await import(
      "@/features/documents/repository"
    );
    const still = await getDocumentById(created.data.id);
    expect(still?.title).toBe("Keep me");
    expect(still?.ownerId).toBe(ownerUid);
    void otherUid;
  });

  it("nonexistent save/rename/delete → not_found", async () => {
    const email = `docs-missing-${randomUUID()}@example.com`;
    const { localId } = await establishSession(email);
    await seedActiveSubscription(localId);

    const {
      saveDocumentAction,
      renameDocumentAction,
      deleteDocumentAction,
    } = await import("@/features/documents/actions");

    const missingId = "missingdocid00000001";
    for (const result of [
      await saveDocumentAction({
        documentId: missingId,
        content: EMPTY_DOCUMENT_CONTENT,
      }),
      await renameDocumentAction({ documentId: missingId, title: "X" }),
      await deleteDocumentAction({ documentId: missingId }),
    ]) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("not_found");
      }
    }
  });

  it("rejects invalid input (121-char title, oversize bytes, unknown nodes)", async () => {
    const email = `docs-invalid-${randomUUID()}@example.com`;
    const { localId } = await establishSession(email);
    await seedActiveSubscription(localId);

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

    const longTitle = await renameDocumentAction({
      documentId: created.data.id,
      title: "x".repeat(121),
    });
    expect(longTitle.ok).toBe(false);
    if (!longTitle.ok) {
      expect(longTitle.code).toBe("invalid");
    }

    const oversized = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "é".repeat(300_000) }],
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

    const unknown = await saveDocumentAction({
      documentId: created.data.id,
      content: {
        type: "doc",
        content: [{ type: "codeBlock", content: [] }],
      },
    });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.code).toBe("invalid");
    }
  });

  it("rejects path-like documentId after auth (id Zod before owner)", async () => {
    const email = `docs-badid-${randomUUID()}@example.com`;
    const { localId } = await establishSession(email);
    await seedActiveSubscription(localId);

    const { saveDocumentAction } = await import("@/features/documents/actions");
    const result = await saveDocumentAction({
      documentId: "../etc/passwd",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid");
    }
  });

  it("off-spec stored JSON loads as contentAllowed=false without overwriting", async () => {
    const email = `docs-corrupt-${randomUUID()}@example.com`;
    const { localId } = await establishSession(email);
    await seedActiveSubscription(localId);

    const { createDocumentAction, saveDocumentAction } = await import(
      "@/features/documents/actions"
    );
    const {
      getDocumentById,
      __unsafeSetDocumentContentForTests,
    } = await import("@/features/documents/repository");

    const created = await createDocumentAction({ title: "Corruptible" });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const evil = JSON.stringify({
      type: "doc",
      content: [{ type: "codeBlock", content: [] }],
    });
    await __unsafeSetDocumentContentForTests({
      documentId: created.data.id,
      contentJson: evil,
    });

    const loaded = await getDocumentById(created.data.id);
    expect(loaded?.contentAllowed).toBe(false);

    // Even if a client tried to save empty after a bad load, Zod allow-list
    // still accepts empty — the editor must refuse. Repository still holds evil.
    const { getAdminFirestore } = await import("@/lib/firebase/admin");
    const raw = await getAdminFirestore()
      .collection("documents")
      .doc(created.data.id)
      .get();
    expect(raw.data()?.content).toBe(evil);

    // Saving allow-listed content as owner still works (repair path).
    const repaired = await saveDocumentAction({
      documentId: created.data.id,
      content: EMPTY_DOCUMENT_CONTENT,
    });
    expect(repaired.ok).toBe(true);
  });

  it("subscriber CRUD persists content and title", async () => {
    const email = `docs-crud-${randomUUID()}@example.com`;
    const { localId: uid } = await establishSession(email);
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
    expect(loaded?.contentAllowed).toBe(true);
    expect(JSON.stringify(loaded?.content)).toContain("Hello field");
    expect(loaded?.ownerId).toBe(uid);

    const list = await listDocumentsForOwner(uid);
    expect(list.some((item) => item.id === created.data.id)).toBe(true);

    const deleted = await deleteDocumentAction({ documentId: created.data.id });
    expect(deleted.ok).toBe(true);
    expect(await getDocumentById(created.data.id)).toBeNull();
  });
});
