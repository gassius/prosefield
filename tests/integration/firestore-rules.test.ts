/**
 * Firestore rules: documents stay default-deny for all clients.
 * Bounds live in Zod (Server Actions); Admin SDK bypasses these rules.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;

if (!firestoreHost) {
  throw new Error(
    "Rules tests require FIRESTORE_EMULATOR_HOST (start with `pnpm backend:up`).",
  );
}

const [host, portString] = firestoreHost.split(":");
const port = Number(portString ?? "8080");

function validPayload(ownerId: string, overrides: Record<string, unknown> = {}) {
  return {
    ownerId,
    title: "Valid title",
    content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("firestore.rules documents default-deny", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const rules = readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8");
    // Bite if create/update/delete are loosened off `if false`.
    expect(rules).toMatch(/allow create:\s*if false;/);
    expect(rules).toMatch(/allow update:\s*if false;/);
    expect(rules).toMatch(/allow delete:\s*if false;/);
    expect(rules).toMatch(/allow read:\s*if false;/);
    expect(rules).not.toMatch(/validDocumentWrite/);
    expect(rules).not.toMatch(/pf_rules_probe/);

    testEnv = await initializeTestEnvironment({
      projectId: "demo-prosefield-rules",
      firestore: {
        host,
        port,
        rules,
      },
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it("denies signed-in owner create (incl. extra fields / client timestamps)", async () => {
    const db = testEnv.authenticatedContext("user-a").firestore();
    await assertFails(
      db.collection("documents").add(validPayload("user-a")),
    );
    await assertFails(
      db.collection("documents").add(
        validPayload("user-a", {
          title: "x".repeat(120),
          extra: "mass-assignment",
          createdAt: "not-a-timestamp",
        }),
      ),
    );
  });

  it("denies signed-in owner update and delete", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("documents").doc("owned").set(
        validPayload("user-a"),
      );
    });
    const db = testEnv.authenticatedContext("user-a").firestore();
    await assertFails(
      db.collection("documents").doc("owned").update({ title: "Hijack" }),
    );
    await assertFails(db.collection("documents").doc("owned").delete());
  });

  it("denies signed-in owner and non-owner read", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("documents").doc("owned").set(
        validPayload("user-a"),
      );
    });
    const ownerDb = testEnv.authenticatedContext("user-a").firestore();
    await assertFails(ownerDb.collection("documents").doc("owned").get());
    const otherDb = testEnv.authenticatedContext("user-b").firestore();
    await assertFails(otherDb.collection("documents").doc("owned").get());
  });

  it("denies unauthenticated read/write", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection("documents").doc("x").get());
    await assertFails(
      db.collection("documents").doc("x").set(validPayload("x")),
    );
  });
});
