/**
 * Firestore rules: default-deny + document title/content bounds helpers.
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

describe("firestore.rules documents bounds + default deny", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const rules = readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8");
    expect(rules).toMatch(/title\.size\(\) <= 120/);
    expect(rules).toMatch(/content\.size\(\) <= 524288/);
    expect(rules).toMatch(/allow read, write: if false/);

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

  it("denies client create even with valid bounds", async () => {
    const db = testEnv.authenticatedContext("user-a").firestore();
    await assertFails(
      db.collection("documents").add({
        ownerId: "user-a",
        title: "Valid title",
        content: JSON.stringify({ type: "doc", content: [] }),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  });

  it("denies client create with overlong title (bounds helper)", async () => {
    const db = testEnv.authenticatedContext("user-a").firestore();
    await assertFails(
      db.collection("documents").add({
        ownerId: "user-a",
        title: "x".repeat(121),
        content: JSON.stringify({ type: "doc", content: [] }),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  });

  it("denies client create with oversize content (bounds helper)", async () => {
    const db = testEnv.authenticatedContext("user-a").firestore();
    await assertFails(
      db.collection("documents").add({
        ownerId: "user-a",
        title: "Ok",
        content: "y".repeat(524289),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  });

  it("denies unauthenticated read/write on documents", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection("documents").doc("x").get());
    await assertFails(
      db.collection("documents").doc("x").set({
        ownerId: "x",
        title: "T",
        content: "{}",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  });
});
