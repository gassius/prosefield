import { beforeEach, describe, expect, it, vi } from "vitest";
import { assembleLocalDevEncryptionKek } from "@/lib/env";

const txSet = vi.fn();
const txGet = vi.fn();
const runTransaction = vi.fn(
  async (fn: (tx: { get: typeof txGet; set: typeof txSet }) => Promise<unknown>) =>
    fn({ get: txGet, set: txSet }),
);
const docGet = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: () => ({
    runTransaction: (
      fn: (tx: { get: typeof txGet; set: typeof txSet }) => Promise<unknown>,
    ) => runTransaction(fn),
    collection: () => ({
      doc: () => ({
        get: docGet,
      }),
    }),
  }),
}));

describe("users document (PII)", () => {
  beforeEach(() => {
    process.env.DOCUMENT_ENCRYPTION_PROVIDER = "dev";
    process.env.DOCUMENT_ENCRYPTION_KEY_VERSION = "1";
    process.env.DOCUMENT_ENCRYPTION_KEK = assembleLocalDevEncryptionKek();
    txSet.mockReset();
    txGet.mockReset();
    docGet.mockReset();
    runTransaction.mockClear();
  });

  it("creates without plaintext email and can retain an encrypted envelope", async () => {
    txGet.mockResolvedValue({ exists: false, data: () => undefined });
    const { upsertUserDocument, getUserDocument, getRetainedUserEmail } =
      await import("@/features/auth/users");

    await upsertUserDocument({
      uid: "u-enc",
      email: "keep@example.com",
      retainEncryptedEmail: true,
    });
    const created = txSet.mock.calls[0]?.[1] as Record<string, unknown>;
    // P3: emailEnc must never ship a plaintext email copy beside it.
    expect(JSON.stringify(created)).not.toContain("keep@example.com");
    expect(created).not.toHaveProperty("email");
    expect(created).not.toHaveProperty("password");
    expect(created.emailEnc).toMatchObject({
      keyVersion: 1,
      wrappedDataKey: expect.any(String),
      cipher: expect.objectContaining({
        ciphertext: expect.any(String),
        iv: expect.any(String),
        tag: expect.any(String),
      }),
    });

    docGet.mockResolvedValue({
      exists: true,
      data: () => ({
        stripeCustomerId: null,
        emailEnc: created.emailEnc,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });
    const user = await getUserDocument("u-enc");
    expect(user?.emailEnc).toBeDefined();
    expect(await getRetainedUserEmail("u-enc")).toBe("keep@example.com");
  });

  it("merge-updates strip plaintext email/password and return null without emailEnc", async () => {
    txGet.mockResolvedValue({
      exists: true,
      data: () => ({ stripeCustomerId: "cus_x", email: "old@example.com" }),
    });
    const { upsertUserDocument, getRetainedUserEmail, getUserDocument } =
      await import("@/features/auth/users");
    await upsertUserDocument({ uid: "u2", email: "x@y.com" });
    const patch = txSet.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(patch).toHaveProperty("email");
    expect(patch).toHaveProperty("password");
    expect(patch).not.toHaveProperty("emailEnc");

    txSet.mockClear();
    txGet.mockResolvedValue({
      exists: true,
      data: () => ({ stripeCustomerId: "cus_x" }),
    });
    await upsertUserDocument({
      uid: "u2",
      email: "retain@example.com",
      retainEncryptedEmail: true,
    });
    const withEnc = txSet.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(withEnc.emailEnc).toBeDefined();
    expect(JSON.stringify(withEnc)).not.toContain("retain@example.com");
    expect(withEnc).toHaveProperty("email");

    docGet.mockResolvedValue({ exists: false });
    expect(await getUserDocument("missing")).toBeNull();
    expect(await getRetainedUserEmail("missing")).toBeNull();

    docGet.mockResolvedValue({
      exists: true,
      data: () => ({ stripeCustomerId: 12 }),
    });
    const coerced = await getUserDocument("u3");
    expect(coerced?.stripeCustomerId).toBeNull();

    docGet.mockResolvedValue({
      exists: true,
      data: () => undefined,
    });
    const emptyData = await getUserDocument("u4");
    expect(emptyData?.stripeCustomerId).toBeNull();
  });
});
