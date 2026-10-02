/**
 * Firestore rules: owner-scoped writes with real title/content bounds.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
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

describe("firestore.rules documents bounds (real)", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const rules = readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8");
    // Anchored so `<= 1200` cannot sneak past.
    expect(rules).toMatch(/title\.size\(\) <= 120;/);
    expect(rules).toMatch(/title\.size\(\) >= 1/);
    expect(rules).toMatch(/content\.size\(\) <= 524288;/);
    expect(rules).not.toMatch(/&& false/);

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

  it("allows owner create at the title boundary (120) and denies 121", async () => {
    const db = testEnv.authenticatedContext("user-a").firestore();
    await assertSucceeds(
      db.collection("documents").add(
        validPayload("user-a", { title: "x".repeat(120) }),
      ),
    );
    await assertFails(
      db.collection("documents").add(
        validPayload("user-a", { title: "x".repeat(121) }),
      ),
    );
  });

  it("denies content over 524288 bytes and allows at the cap", async () => {
    const db = testEnv.authenticatedContext("user-a").firestore();
    await assertSucceeds(
      db.collection("documents").add(
        validPayload("user-a", { content: "y".repeat(524288) }),
      ),
    );
    await assertFails(
      db.collection("documents").add(
        validPayload("user-a", { content: "y".repeat(524289) }),
      ),
    );
  });

  it("denies create for a different ownerId than auth.uid", async () => {
    const db = testEnv.authenticatedContext("user-a").firestore();
    await assertFails(
      db.collection("documents").add(validPayload("user-b")),
    );
  });

  it("denies unauthenticated read/write", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection("documents").doc("x").get());
    await assertFails(
      db.collection("documents").doc("x").set(validPayload("x")),
    );
  });

  it("denies client read even for the owner", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("documents").doc("owned").set(
        validPayload("user-a"),
      );
    });
    const db = testEnv.authenticatedContext("user-a").firestore();
    await assertFails(db.collection("documents").doc("owned").get());
  });
});
