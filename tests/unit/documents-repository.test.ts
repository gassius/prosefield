import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_DOCUMENT_CONTENT } from "@/features/documents/schemas";
import { assembleLocalDevEncryptionKek } from "@/lib/env";
import { encryptDocumentFields } from "@/lib/crypto/envelope";

const refGet = vi.fn();
const refSet = vi.fn();
const refUpdate = vi.fn();
const refDelete = vi.fn();
const txGet = vi.fn();
const txUpdate = vi.fn();
const docsQueryGet = vi.fn();
const runTransaction = vi.fn(
  async (fn: (tx: { get: typeof txGet; update: typeof txUpdate }) => Promise<unknown>) =>
    fn({ get: txGet, update: txUpdate }),
);

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: () => ({
    runTransaction: (fn: (tx: { get: typeof txGet; update: typeof txUpdate }) => Promise<unknown>) =>
      runTransaction(fn),
    collection: () => ({
      doc: (documentPath?: string) => {
        if (
          typeof documentPath === "string" &&
          (documentPath.includes("/") ||
            documentPath === "." ||
            documentPath === "..")
        ) {
          throw new Error(
            `Value for argument "documentPath" is not a valid resource path: ${documentPath}`,
          );
        }
        return {
          get: refGet,
          set: refSet,
          update: refUpdate,
          delete: refDelete,
          id: documentPath ?? "newdocid00000000001",
        };
      },
      where: () => ({
        orderBy: () => ({
          get: docsQueryGet,
        }),
      }),
    }),
  }),
}));

process.env.DOCUMENT_ENCRYPTION_PROVIDER = "dev";
process.env.DOCUMENT_ENCRYPTION_KEY_VERSION = "1";
process.env.DOCUMENT_ENCRYPTION_KEK = assembleLocalDevEncryptionKek();

async function encryptedFields(
  ownerId: string,
  docId: string,
  title = "T",
  content = EMPTY_DOCUMENT_CONTENT,
) {
  return encryptDocumentFields({
    uid: ownerId,
    docId,
    title,
    content: JSON.stringify(content),
  });
}

async function ownedSnap(overrides: Record<string, unknown> = {}) {
  const fields = await encryptedFields("u1", "d1");
  return {
    exists: true,
    id: "d1",
    data: () => ({
      ownerId: "u1",
      ...fields,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }),
  };
}

describe("documents repository", () => {
  beforeEach(() => {
    refGet.mockReset();
    refSet.mockReset();
    refUpdate.mockReset();
    refDelete.mockReset();
    txGet.mockReset();
    txUpdate.mockReset();
    docsQueryGet.mockReset();
    runTransaction.mockClear();
  });

  it("parses encrypted, legacy plaintext, invalid JSON, and non-object content", async () => {
    const { getDocumentById, listDocumentsForOwner, createDocument, deleteDocument } =
      await import("@/features/documents/repository");

    const enc = await encryptedFields("u1", "d1", "T", {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
    });
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => ({
        ownerId: "u1",
        ...enc,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
      }),
    });
    const parsed = await getDocumentById("d1");
    expect(parsed?.contentAllowed).toBe(true);
    expect(parsed?.content).toMatchObject({ type: "doc" });

    // Legacy plaintext map content — read does NOT migrate (write-path only).
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "d2",
      data: () => ({
        ownerId: "u1",
        title: "Map",
        content: { type: "doc", content: [{ type: "paragraph" }] },
        createdAt: null,
        updatedAt: null,
      }),
    });
    const mapped = await getDocumentById("d2");
    expect(mapped?.contentAllowed).toBe(true);
    expect(txUpdate).not.toHaveBeenCalled();

    refGet.mockResolvedValueOnce({
      exists: true,
      id: "d3",
      data: () => ({
        ownerId: "u1",
        title: "Bad",
        content: "{not-json",
      }),
    });
    const bad = await getDocumentById("d3");
    expect(bad?.contentAllowed).toBe(false);

    refGet.mockResolvedValueOnce({
      exists: true,
      id: "d4",
      data: () => ({
        ownerId: "u1",
        title: "Nullish",
        content: 42,
      }),
    });
    const nullish = await getDocumentById("d4");
    expect(nullish?.contentAllowed).toBe(false);
    expect(nullish?.content).toEqual(EMPTY_DOCUMENT_CONTENT);

    refGet.mockResolvedValueOnce({
      exists: true,
      id: "d5",
      data: () => ({
        ownerId: "u1",
        title: "Evil",
        content: JSON.stringify({
          type: "doc",
          content: [{ type: "codeBlock", content: [] }],
        }),
      }),
    });
    const evil = await getDocumentById("d5");
    expect(evil?.contentAllowed).toBe(false);

    const { Timestamp } = await import("firebase-admin/firestore");
    const stampedFields = await encryptedFields("u1", "d7", "Stamped");
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "d7",
      data: () => ({
        ownerId: "u1",
        ...stampedFields,
        createdAt: Timestamp.fromDate(new Date("2026-04-01T00:00:00Z")),
        updatedAt: Timestamp.fromDate(new Date("2026-04-02T00:00:00Z")),
      }),
    });
    const stamped = await getDocumentById("d7");
    expect(stamped?.createdAt.toISOString()).toContain("2026-04-01");
    expect(stamped?.title).toBe("Stamped");

    const listA = await encryptedFields("u1", "a", "A");
    const listB = await encryptedFields("u1", "b", "Untitled document");
    docsQueryGet.mockResolvedValueOnce({
      docs: [
        {
          id: "a",
          data: () => ({
            ownerId: "u1",
            ...listA,
            updatedAt: new Date("2026-02-01"),
          }),
        },
        {
          id: "b",
          data: () => ({
            ownerId: "u1",
            ...listB,
            updatedAt: new Date("2026-02-01"),
          }),
        },
      ],
    });
    const list = await listDocumentsForOwner("u1");
    expect(list[0]?.title).toBe("A");
    expect(list[1]?.title).toBe("Untitled document");

    refSet.mockResolvedValue(undefined);
    const createdFields = await encryptedFields(
      "u1",
      "newdocid00000000001",
      "Untitled document",
    );
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "newdocid00000000001",
      data: () => ({
        ownerId: "u1",
        ...createdFields,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });
    const created = await createDocument({ ownerId: "u1" });
    expect(created.id).toBe("newdocid00000000001");
    expect(created.contentAllowed).toBe(true);
    const setPayload = refSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setPayload).toHaveProperty("wrappedDataKey");
    expect(setPayload).toHaveProperty("contentCipher");
    expect(JSON.stringify(setPayload)).not.toContain('"type":"doc"');

    refGet.mockResolvedValueOnce({ exists: true });
    refDelete.mockResolvedValue(undefined);
    expect(await deleteDocument("d1")).toBe(true);
    refGet.mockResolvedValueOnce({ exists: false });
    expect(await deleteDocument("missing")).toBe(false);

    refSet.mockResolvedValue(undefined);
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "newdocid00000000001",
      data: () => undefined,
    });
    const createdFallback = await createDocument({
      ownerId: "u1",
      title: "   ",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    expect(createdFallback.title).toBe("Untitled document");
    expect(createdFallback.ownerId).toBe("u1");

    const noOwnerFields = await encryptedFields("u1", "d8", "No owner string");
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "d8",
      data: () => ({
        ownerId: 42,
        ...noOwnerFields,
        createdAt: new Date("2026-05-01"),
        updatedAt: new Date("2026-05-02"),
      }),
    });
    const noOwner = await getDocumentById("d8");
    expect(noOwner?.ownerId).toBe("");
    // Wrong AAD owner → contentAllowed false
    expect(noOwner?.contentAllowed).toBe(false);

    refGet.mockResolvedValueOnce({ exists: false });
    expect(await getDocumentById("missing-doc-id-0001")).toBeNull();

    refGet.mockResolvedValueOnce({
      exists: true,
      id: "d9",
      data: () => undefined,
    });
    const emptySnap = await getDocumentById("d9");
    expect(emptySnap?.title).toBe("Untitled document");
    expect(emptySnap?.contentAllowed).toBe(false);
  });

  it("updateDocumentContent uses tx.get/tx.update with ownership inside the transaction", async () => {
    const { Timestamp } = await import("firebase-admin/firestore");
    const { updateDocumentContent } = await import(
      "@/features/documents/repository"
    );

    const storedUpdatedAt = Timestamp.fromDate(
      new Date("2026-06-15T12:00:00.000Z"),
    );
    txGet.mockResolvedValueOnce(await ownedSnap());
    const afterFields = await encryptedFields("u1", "d1");
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => ({
        ownerId: "u1",
        ...afterFields,
        createdAt: new Date("2026-01-01"),
        updatedAt: storedUpdatedAt,
      }),
    });
    refUpdate.mockResolvedValue(undefined);
    const afterUpdate = await updateDocumentContent({
      documentId: "d1",
      ownerId: "u1",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    expect(afterUpdate?.contentAllowed).toBe(true);
    expect(afterUpdate?.updatedAt.toISOString()).toBe(
      "2026-06-15T12:00:00.000Z",
    );
    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(txGet).toHaveBeenCalledTimes(1);
    expect(txUpdate).toHaveBeenCalledTimes(1);
    expect(refGet).toHaveBeenCalledTimes(1);
    expect(refUpdate).not.toHaveBeenCalled();
    const updatePayload = txUpdate.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(updatePayload).toHaveProperty("contentCipher");
    expect(JSON.stringify(updatePayload)).not.toContain('"type":"doc"');

    txGet.mockResolvedValueOnce({ exists: false });
    expect(
      await updateDocumentContent({
        documentId: "x",
        ownerId: "u1",
        content: EMPTY_DOCUMENT_CONTENT,
      }),
    ).toBeNull();
    expect(txUpdate).toHaveBeenCalledTimes(1);
    expect(refUpdate).not.toHaveBeenCalled();
    expect(refGet).toHaveBeenCalledTimes(1);

    txGet.mockResolvedValueOnce(await ownedSnap({ ownerId: "other" }));
    expect(
      await updateDocumentContent({
        documentId: "d1",
        ownerId: "u1",
        content: EMPTY_DOCUMENT_CONTENT,
      }),
    ).toBeNull();
    expect(txUpdate).toHaveBeenCalledTimes(1);
    expect(refUpdate).not.toHaveBeenCalled();

    const sparseFields = await encryptedFields("u1", "d1");
    txGet.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => ({ ownerId: "u1", ...sparseFields }),
    });
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => ({
        ownerId: "u1",
        ...sparseFields,
        updatedAt: storedUpdatedAt,
      }),
    });
    const updatedSparse = await updateDocumentContent({
      documentId: "d1",
      ownerId: "u1",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    expect(updatedSparse?.contentAllowed).toBe(true);
    expect(updatedSparse?.title).toBe("T");
    expect(updatedSparse?.updatedAt.toISOString()).toBe(
      "2026-06-15T12:00:00.000Z",
    );
    expect(refUpdate).not.toHaveBeenCalled();

    txGet.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => undefined,
    });
    const updatedEmptyData = await updateDocumentContent({
      documentId: "d1",
      ownerId: "u1",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    expect(updatedEmptyData).toBeNull();
    expect(refUpdate).not.toHaveBeenCalled();

    txGet.mockResolvedValueOnce(await ownedSnap());
    refGet.mockResolvedValueOnce({ exists: false });
    expect(
      await updateDocumentContent({
        documentId: "d1",
        ownerId: "u1",
        content: EMPTY_DOCUMENT_CONTENT,
      }),
    ).toBeNull();
    expect(txUpdate).toHaveBeenCalled();
    expect(refUpdate).not.toHaveBeenCalled();

    txGet.mockResolvedValueOnce(await ownedSnap());
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => undefined,
    });
    const emptyAfter = await updateDocumentContent({
      documentId: "d1",
      ownerId: "u1",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    expect(emptyAfter?.id).toBe("d1");
    expect(emptyAfter?.title).toBe("Untitled document");
    expect(refUpdate).not.toHaveBeenCalled();
  });

  it("renameDocument uses tx.get/tx.update with ownership inside the transaction", async () => {
    const { Timestamp } = await import("firebase-admin/firestore");
    const { renameDocument } = await import("@/features/documents/repository");

    const storedUpdatedAt = Timestamp.fromDate(
      new Date("2026-07-01T08:30:00.000Z"),
    );
    txGet.mockResolvedValueOnce(await ownedSnap());
    const renamedFields = await encryptedFields("u1", "d1", "Renamed");
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => ({
        ownerId: "u1",
        ...renamedFields,
        createdAt: new Date("2026-01-01"),
        updatedAt: storedUpdatedAt,
      }),
    });
    refUpdate.mockResolvedValue(undefined);
    const afterRename = await renameDocument({
      documentId: "d1",
      ownerId: "u1",
      title: "Renamed",
    });
    expect(afterRename?.title).toBe("Renamed");
    expect(afterRename?.updatedAt.toISOString()).toBe(
      "2026-07-01T08:30:00.000Z",
    );
    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(txGet).toHaveBeenCalledTimes(1);
    expect(txUpdate).toHaveBeenCalledTimes(1);
    expect(refGet).toHaveBeenCalledTimes(1);
    expect(refUpdate).not.toHaveBeenCalled();

    txGet.mockResolvedValueOnce({ exists: false });
    expect(
      await renameDocument({ documentId: "x", ownerId: "u1", title: "Y" }),
    ).toBeNull();
    expect(refUpdate).not.toHaveBeenCalled();

    txGet.mockResolvedValueOnce(await ownedSnap({ ownerId: "other" }));
    expect(
      await renameDocument({ documentId: "d1", ownerId: "u1", title: "Nope" }),
    ).toBeNull();
    expect(txUpdate).toHaveBeenCalledTimes(1);
    expect(refUpdate).not.toHaveBeenCalled();

    const renameSparseIn = await encryptedFields("u1", "d1");
    const renameSparseOut = await encryptedFields("u1", "d1", "After");
    txGet.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => ({ ownerId: "u1", ...renameSparseIn }),
    });
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => ({
        ownerId: "u1",
        ...renameSparseOut,
        updatedAt: storedUpdatedAt,
      }),
    });
    const renamedSparse = await renameDocument({
      documentId: "d1",
      ownerId: "u1",
      title: "After",
    });
    expect(renamedSparse?.title).toBe("After");
    expect(renamedSparse?.updatedAt.toISOString()).toBe(
      "2026-07-01T08:30:00.000Z",
    );
    expect(refUpdate).not.toHaveBeenCalled();

    txGet.mockResolvedValueOnce(await ownedSnap());
    refGet.mockResolvedValueOnce({ exists: false });
    expect(
      await renameDocument({
        documentId: "d1",
        ownerId: "u1",
        title: "Gone",
      }),
    ).toBeNull();
    expect(refUpdate).not.toHaveBeenCalled();

    txGet.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => undefined,
    });
    expect(
      await renameDocument({
        documentId: "d1",
        ownerId: "u1",
        title: "Nope",
      }),
    ).toBeNull();

    txGet.mockResolvedValueOnce(await ownedSnap());
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => undefined,
    });
    const renamedEmptyAfter = await renameDocument({
      documentId: "d1",
      ownerId: "u1",
      title: "After empty",
    });
    expect(renamedEmptyAfter?.id).toBe("d1");
    expect(renamedEmptyAfter?.title).toBe("Untitled document");
    expect(refUpdate).not.toHaveBeenCalled();
  });

  it("update/rename from legacy plaintext and empty encrypted title", async () => {
    const { Timestamp } = await import("firebase-admin/firestore");
    const {
      updateDocumentContent,
      renameDocument,
      migrateLegacyDocument,
    } = await import("@/features/documents/repository");
    const { encryptDocumentFields } = await import("@/lib/crypto/envelope");

    const storedUpdatedAt = Timestamp.fromDate(
      new Date("2026-08-01T00:00:00.000Z"),
    );

    // Legacy plaintext update path (title string, no cipher fields).
    txGet.mockResolvedValueOnce({
      exists: true,
      id: "legacy1",
      data: () => ({
        ownerId: "u1",
        title: "Legacy",
        content: JSON.stringify(EMPTY_DOCUMENT_CONTENT),
      }),
    });
    const afterLegacyFields = await encryptedFields("u1", "legacy1", "Legacy");
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "legacy1",
      data: () => ({
        ownerId: "u1",
        ...afterLegacyFields,
        updatedAt: storedUpdatedAt,
      }),
    });
    const updatedLegacy = await updateDocumentContent({
      documentId: "legacy1",
      ownerId: "u1",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    expect(updatedLegacy?.title).toBe("Legacy");

    // Legacy plaintext rename path.
    txGet.mockResolvedValueOnce({
      exists: true,
      id: "legacy2",
      data: () => ({
        ownerId: "u1",
        title: "Old",
        content: JSON.stringify(EMPTY_DOCUMENT_CONTENT),
      }),
    });
    const renamedLegacyFields = await encryptedFields(
      "u1",
      "legacy2",
      "New title",
    );
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "legacy2",
      data: () => ({
        ownerId: "u1",
        ...renamedLegacyFields,
        updatedAt: storedUpdatedAt,
      }),
    });
    const renamedLegacy = await renameDocument({
      documentId: "legacy2",
      ownerId: "u1",
      title: "New title",
    });
    expect(renamedLegacy?.title).toBe("New title");

    // Empty encrypted title falls back to default during update.
    const emptyTitleFields = await encryptDocumentFields({
      uid: "u1",
      docId: "d-empty",
      title: "",
      content: JSON.stringify(EMPTY_DOCUMENT_CONTENT),
    });
    txGet.mockResolvedValueOnce({
      exists: true,
      id: "d-empty",
      data: () => ({ ownerId: "u1", ...emptyTitleFields }),
    });
    const afterEmpty = await encryptDocumentFields({
      uid: "u1",
      docId: "d-empty",
      title: "Untitled document",
      content: JSON.stringify(EMPTY_DOCUMENT_CONTENT),
    });
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "d-empty",
      data: () => ({
        ownerId: "u1",
        ...afterEmpty,
        updatedAt: storedUpdatedAt,
      }),
    });
    const updatedEmptyTitle = await updateDocumentContent({
      documentId: "d-empty",
      ownerId: "u1",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    expect(updatedEmptyTitle?.title).toBe("Untitled document");

    // migrateLegacyDocument no-ops when already encrypted or missing/wrong owner.
    const alreadyEncrypted = await encryptedFields("u1", "d1");
    txGet.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => ({ ownerId: "u1", ...alreadyEncrypted }),
    });
    expect(
      await migrateLegacyDocument({
        id: "d1",
        ownerId: "u1",
        title: "T",
        content: EMPTY_DOCUMENT_CONTENT,
        contentAllowed: true,
      ignoredWords: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toBe(false);

    txGet.mockResolvedValueOnce({ exists: false });
    expect(
      await migrateLegacyDocument({
        id: "missing",
        ownerId: "u1",
        title: "T",
        content: EMPTY_DOCUMENT_CONTENT,
        contentAllowed: true,
      ignoredWords: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toBe(false);

    txGet.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => ({
        ownerId: "other",
        title: "T",
        content: JSON.stringify(EMPTY_DOCUMENT_CONTENT),
      }),
    });
    expect(
      await migrateLegacyDocument({
        id: "d1",
        ownerId: "u1",
        title: "T",
        content: EMPTY_DOCUMENT_CONTENT,
        contentAllowed: true,
      ignoredWords: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toBe(false);

    // Legacy update when title is not a string → default title.
    txGet.mockResolvedValueOnce({
      exists: true,
      id: "legacy3",
      data: () => ({
        ownerId: "u1",
        title: 42,
        content: JSON.stringify(EMPTY_DOCUMENT_CONTENT),
      }),
    });
    const legacy3Fields = await encryptedFields(
      "u1",
      "legacy3",
      "Untitled document",
    );
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "legacy3",
      data: () => ({
        ownerId: "u1",
        ...legacy3Fields,
        updatedAt: storedUpdatedAt,
      }),
    });
    const updatedNonStringTitle = await updateDocumentContent({
      documentId: "legacy3",
      ownerId: "u1",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    expect(updatedNonStringTitle?.title).toBe("Untitled document");

    // Read of legacy never opens a migration transaction.
    const txCallsBeforeRead = runTransaction.mock.calls.length;
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "legacy-boom",
      data: () => ({
        ownerId: "u1",
        title: "Boom",
        content: JSON.stringify(EMPTY_DOCUMENT_CONTENT),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });
    const { getDocumentById } = await import(
      "@/features/documents/repository"
    );
    const boom = await getDocumentById("legacy-boom");
    expect(boom?.title).toBe("Boom");
    expect(boom?.contentAllowed).toBe(true);
    expect(runTransaction.mock.calls.length).toBe(txCallsBeforeRead);

    // Encrypted doc with empty title decrypts to the default.
    const emptyTitleRead = await encryptDocumentFields({
      uid: "u1",
      docId: "empty-title-read",
      title: "",
      content: JSON.stringify(EMPTY_DOCUMENT_CONTENT),
    });
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "empty-title-read",
      data: () => ({
        ownerId: "u1",
        ...emptyTitleRead,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });
    const emptyTitleDoc = await getDocumentById("empty-title-read");
    expect(emptyTitleDoc?.title).toBe("Untitled document");

    // migrate when snap.data() is undefined / non-string title.
    txGet.mockResolvedValueOnce({
      exists: true,
      id: "mig-undef",
      data: () => undefined,
    });
    expect(
      await migrateLegacyDocument({
        id: "mig-undef",
        ownerId: "u1",
        title: "T",
        content: EMPTY_DOCUMENT_CONTENT,
        contentAllowed: true,
      ignoredWords: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toBe(false);

    txGet.mockResolvedValueOnce({
      exists: true,
      id: "mig-title",
      data: () => ({
        ownerId: "u1",
        title: 7,
        content: JSON.stringify(EMPTY_DOCUMENT_CONTENT),
      }),
    });
    expect(
      await migrateLegacyDocument({
        id: "mig-title",
        ownerId: "u1",
        title: "T",
        content: EMPTY_DOCUMENT_CONTENT,
        contentAllowed: true,
      ignoredWords: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toBe(true);
    expect(txUpdate).toHaveBeenCalled();
  });

  it("RN2: legacy rename encrypts off-spec content verbatim (not re-parsed)", async () => {
    const { renameDocument } = await import("@/features/documents/repository");
    const { decryptDocumentFields } = await import("@/lib/crypto/envelope");

    const evil = JSON.stringify({
      type: "doc",
      content: [{ type: "codeBlock", content: [] }],
    });

    txGet.mockResolvedValueOnce({
      exists: true,
      id: "rn2-legacy",
      data: () => ({
        ownerId: "u1",
        title: "Old legacy",
        content: evil,
      }),
    });
    // Return value after write is secondary — the bite is on the tx payload.
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "rn2-legacy",
      data: () => ({
        ownerId: "u1",
        keyVersion: 1,
        wrappedDataKey: "placeholder",
        titleCipher: { ciphertext: "t", iv: "i", tag: "g" },
        contentCipher: { ciphertext: "c", iv: "i", tag: "g" },
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });

    await renameDocument({
      documentId: "rn2-legacy",
      ownerId: "u1",
      title: "New legacy title",
    });

    const payload = txUpdate.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(payload).toBeTruthy();
    expect(typeof payload.title).not.toBe("string");
    expect(typeof payload.content).not.toBe("string");
    expect(payload).toHaveProperty("contentCipher");
    expect(payload).toHaveProperty("titleCipher");

    const decrypted = await decryptDocumentFields({
      uid: "u1",
      docId: "rn2-legacy",
      fields: {
        keyVersion: payload.keyVersion as number,
        wrappedDataKey: payload.wrappedDataKey as string,
        titleCipher: payload.titleCipher as {
          ciphertext: string;
          iv: string;
          tag: string;
        },
        contentCipher: payload.contentCipher as {
          ciphertext: string;
          iv: string;
          tag: string;
        },
      },
    });
    expect(decrypted.content).toBe(evil);
    expect(decrypted.content).not.toBe(JSON.stringify(EMPTY_DOCUMENT_CONTENT));
    expect(decrypted.title).toBe("New legacy title");
  });

  it("P1–P3: rename/migrate never empty off-spec content; malformed fails closed", async () => {
    const { renameDocument, migrateLegacyDocument, getDocumentById } =
      await import("@/features/documents/repository");
    const { encryptDocumentFields, decryptDocumentFields } = await import(
      "@/lib/crypto/envelope"
    );

    const evil = JSON.stringify({
      type: "doc",
      content: [{ type: "codeBlock", content: [] }],
    });

    // P1: rename of encrypted off-spec doc keeps contentCipher / evil bytes.
    const offSpec = await encryptDocumentFields({
      uid: "u1",
      docId: "p1",
      title: "Off",
      content: evil,
    });
    txGet.mockResolvedValueOnce({
      exists: true,
      id: "p1",
      data: () => ({ ownerId: "u1", ...offSpec }),
    });
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "p1",
      data: () => ({
        ownerId: "u1",
        ...offSpec,
        // titleCipher will be rewritten; contentCipher must stay the probe's.
        updatedAt: new Date(),
        createdAt: new Date(),
      }),
    });
    await renameDocument({
      documentId: "p1",
      ownerId: "u1",
      title: "Renamed",
    });
    const p1Update = txUpdate.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(p1Update).toHaveProperty("titleCipher");
    expect(p1Update).not.toHaveProperty("contentCipher");
    expect(p1Update).not.toHaveProperty("wrappedDataKey");
    // Decrypt original contentCipher still yields evil.
    const stillEvil = await decryptDocumentFields({
      uid: "u1",
      docId: "p1",
      fields: offSpec,
    });
    expect(stillEvil.content).toBe(evil);

    // P2: migrate legacy off-spec encrypts verbatim (not EMPTY_DOCUMENT).
    txUpdate.mockClear();
    txGet.mockResolvedValueOnce({
      exists: true,
      id: "p2",
      data: () => ({
        ownerId: "u1",
        title: "Legacy off",
        content: evil,
      }),
    });
    expect(
      await migrateLegacyDocument({
        id: "p2",
        ownerId: "u1",
        title: "Legacy off",
        content: EMPTY_DOCUMENT_CONTENT,
        contentAllowed: false,
      ignoredWords: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toBe(true);
    const p2Update = txUpdate.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(p2Update).not.toHaveProperty("updatedAt");
    const migrated = await decryptDocumentFields({
      uid: "u1",
      docId: "p2",
      fields: {
        keyVersion: p2Update.keyVersion as number,
        wrappedDataKey: p2Update.wrappedDataKey as string,
        titleCipher: p2Update.titleCipher as {
          ciphertext: string;
          iv: string;
          tag: string;
        },
        contentCipher: p2Update.contentCipher as {
          ciphertext: string;
          iv: string;
          tag: string;
        },
      },
    });
    expect(migrated.content).toBe(evil);
    expect(migrated.content).not.toBe(JSON.stringify(EMPTY_DOCUMENT_CONTENT));

    // P3: malformed keyVersion string → unreadable, never rewritten.
    const txCallsBefore = runTransaction.mock.calls.length;
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "p3",
      data: () => ({
        ownerId: "u1",
        keyVersion: "1",
        wrappedDataKey: offSpec.wrappedDataKey,
        titleCipher: offSpec.titleCipher,
        contentCipher: offSpec.contentCipher,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });
    const malformed = await getDocumentById("p3");
    expect(malformed?.contentAllowed).toBe(false);
    expect(runTransaction.mock.calls.length).toBe(txCallsBefore);

    txGet.mockResolvedValueOnce({
      exists: true,
      id: "p3",
      data: () => ({
        ownerId: "u1",
        keyVersion: "1",
        wrappedDataKey: offSpec.wrappedDataKey,
        titleCipher: offSpec.titleCipher,
        contentCipher: offSpec.contentCipher,
      }),
    });
    expect(
      await renameDocument({
        documentId: "p3",
        ownerId: "u1",
        title: "Nope",
      }),
    ).toBeNull();
  });

  it("MF1: malformed envelope with plaintext fails closed on read (never returns plaintext)", async () => {
    const { getDocumentById } = await import(
      "@/features/documents/repository"
    );
    const { encryptDocumentFields } = await import("@/lib/crypto/envelope");

    const offSpec = await encryptDocumentFields({
      uid: "u1",
      docId: "mf1",
      title: "Hidden",
      content: JSON.stringify({
        type: "doc",
        content: [{ type: "codeBlock", content: [] }],
      }),
    });
    const leakedTitle = "LEAKED-PLAINTEXT-TITLE";
    const leakedContent = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "LEAKED-PLAINTEXT-BODY" }],
        },
      ],
    });

    // Partial envelope + plaintext siblings (string keyVersion makes it malformed).
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "mf1",
      data: () => ({
        ownerId: "u1",
        keyVersion: "1",
        wrappedDataKey: offSpec.wrappedDataKey,
        titleCipher: offSpec.titleCipher,
        contentCipher: offSpec.contentCipher,
        title: leakedTitle,
        content: leakedContent,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });
    const txCallsBefore = runTransaction.mock.calls.length;
    const record = await getDocumentById("mf1");
    expect(record?.contentAllowed).toBe(false);
    expect(record?.title).not.toBe(leakedTitle);
    expect(record?.title).toBe("Untitled document");
    expect(JSON.stringify(record)).not.toContain("LEAKED-PLAINTEXT");
    expect(runTransaction.mock.calls.length).toBe(txCallsBefore);
  });

  it("MF5: non-integer keyVersion is malformed and fail-closed on read", async () => {
    const { getDocumentById } = await import(
      "@/features/documents/repository"
    );
    const { encryptDocumentFields, isEncryptedDocumentData } = await import(
      "@/lib/crypto/envelope"
    );

    const fields = await encryptDocumentFields({
      uid: "u1",
      docId: "mf5",
      title: "T",
      content: JSON.stringify(EMPTY_DOCUMENT_CONTENT),
    });
    const floatVersion = {
      ...fields,
      keyVersion: 1.5,
      title: "should-not-surface",
      content: JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "float-leak" }],
          },
        ],
      }),
    };
    expect(isEncryptedDocumentData(floatVersion)).toBe(false);

    refGet.mockResolvedValueOnce({
      exists: true,
      id: "mf5",
      data: () => ({
        ownerId: "u1",
        ...floatVersion,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });
    const record = await getDocumentById("mf5");
    expect(record?.contentAllowed).toBe(false);
    expect(JSON.stringify(record)).not.toContain("float-leak");
    expect(record?.title).not.toBe("should-not-surface");
  });

  it("covers list malformed/empty-title, update malformed, migrate no-plaintext, rename empty legacy", async () => {
    const {
      listDocumentsForOwner,
      updateDocumentContent,
      migrateLegacyDocument,
      renameDocument,
    } = await import("@/features/documents/repository");
    const { encryptDocumentFields } = await import("@/lib/crypto/envelope");

    const emptyTitle = await encryptDocumentFields({
      uid: "u1",
      docId: "list-empty",
      title: "",
      content: JSON.stringify(EMPTY_DOCUMENT_CONTENT),
    });
    const good = await encryptedFields("u1", "list-good", "Good");
    docsQueryGet.mockResolvedValueOnce({
      docs: [
        {
          id: "list-empty",
          data: () => ({ ownerId: "u1", ...emptyTitle, updatedAt: new Date() }),
        },
        {
          id: "list-malformed",
          data: () => ({
            ownerId: "u1",
            keyVersion: "1",
            wrappedDataKey: good.wrappedDataKey,
            titleCipher: good.titleCipher,
            contentCipher: good.contentCipher,
            updatedAt: new Date(),
          }),
        },
        {
          id: "list-legacy",
          data: () => ({
            ownerId: "u1",
            title: 42,
            updatedAt: new Date(),
          }),
        },
        {
          id: "list-plain",
          data: () => ({
            ownerId: "u1",
            title: "Plain title",
            updatedAt: new Date(),
          }),
        },
        {
          id: "list-no-owner",
          data: () => ({
            ownerId: 99,
            title: "NoOwner",
            updatedAt: new Date(),
          }),
        },
        {
          id: "list-boom",
          data: () => ({
            ownerId: "u1",
            ...good,
            // Wrong owner binding in AAD via mismatched uid stored as ownerId ok —
            // force decrypt failure by corrupting wrapped key.
            wrappedDataKey: Buffer.from("nope").toString("base64"),
            updatedAt: new Date(),
          }),
        },
      ],
    });
    const listed = await listDocumentsForOwner("u1");
    expect(listed.map((i) => i.title)).toEqual([
      "Untitled document",
      "Untitled document",
      "Untitled document",
      "Plain title",
      "NoOwner",
      "Untitled document",
    ]);

    txGet.mockResolvedValueOnce({
      exists: true,
      id: "upd-mal",
      data: () => ({
        ownerId: "u1",
        keyVersion: "1",
        wrappedDataKey: "x",
        titleCipher: good.titleCipher,
        contentCipher: good.contentCipher,
      }),
    });
    expect(
      await updateDocumentContent({
        documentId: "upd-mal",
        ownerId: "u1",
        content: EMPTY_DOCUMENT_CONTENT,
      }),
    ).toBeNull();

    txGet.mockResolvedValueOnce({
      exists: true,
      id: "mig-empty",
      data: () => ({ ownerId: "u1" }),
    });
    expect(
      await migrateLegacyDocument({
        id: "mig-empty",
        ownerId: "u1",
        title: "T",
        content: EMPTY_DOCUMENT_CONTENT,
        contentAllowed: true,
      ignoredWords: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toBe(false);

    txGet.mockResolvedValueOnce({
      exists: true,
      id: "mig-mal",
      data: () => ({
        ownerId: "u1",
        keyVersion: "1",
        wrappedDataKey: "x",
      }),
    });
    expect(
      await migrateLegacyDocument({
        id: "mig-mal",
        ownerId: "u1",
        title: "T",
        content: EMPTY_DOCUMENT_CONTENT,
        contentAllowed: false,
      ignoredWords: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toBe(false);

    txGet.mockResolvedValueOnce({
      exists: true,
      id: "rename-empty-legacy",
      data: () => ({ ownerId: "u1", title: "OnlyTitle" }),
    });
    const renamedFields = await encryptedFields(
      "u1",
      "rename-empty-legacy",
      "New",
    );
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "rename-empty-legacy",
      data: () => ({
        ownerId: "u1",
        ...renamedFields,
        updatedAt: new Date(),
      }),
    });
    const renamed = await renameDocument({
      documentId: "rename-empty-legacy",
      ownerId: "u1",
      title: "New",
    });
    expect(renamed?.title).toBe("New");

    // Title-only legacy (no content field) → empty doc body on migrate (line 262).
    txGet.mockResolvedValueOnce({
      exists: true,
      id: "mig-title-only",
      data: () => ({ ownerId: "u1", title: "TitleOnly" }),
    });
    expect(
      await migrateLegacyDocument({
        id: "mig-title-only",
        ownerId: "u1",
        title: "TitleOnly",
        content: EMPTY_DOCUMENT_CONTENT,
        contentAllowed: true,
      ignoredWords: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toBe(true);

    // Object-shaped legacy content is serialised verbatim (legacyContentString).
    txGet.mockResolvedValueOnce({
      exists: true,
      id: "mig-obj",
      data: () => ({
        ownerId: "u1",
        title: "Obj",
        content: { type: "doc", content: [{ type: "paragraph" }] },
      }),
    });
    expect(
      await migrateLegacyDocument({
        id: "mig-obj",
        ownerId: "u1",
        title: "Obj",
        content: EMPTY_DOCUMENT_CONTENT,
        contentAllowed: true,
      ignoredWords: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toBe(true);
    const objUpdate = txUpdate.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    const { decryptDocumentFields } = await import("@/lib/crypto/envelope");
    const objPlain = await decryptDocumentFields({
      uid: "u1",
      docId: "mig-obj",
      fields: {
        keyVersion: objUpdate.keyVersion as number,
        wrappedDataKey: objUpdate.wrappedDataKey as string,
        titleCipher: objUpdate.titleCipher as {
          ciphertext: string;
          iv: string;
          tag: string;
        },
        contentCipher: objUpdate.contentCipher as {
          ciphertext: string;
          iv: string;
          tag: string;
        },
      },
    });
    expect(objPlain.content).toContain('"type":"doc"');

    // Round-trip verification failure aborts migration (no silent empty write).
    const envelope = await import("@/lib/crypto/envelope");
    const decryptSpy = vi
      .spyOn(envelope, "decryptDocumentFields")
      .mockResolvedValue({ title: "nope", content: "nope", ignoredWords: "[]" });
    txGet.mockResolvedValueOnce({
      exists: true,
      id: "mig-verify",
      data: () => ({
        ownerId: "u1",
        title: "V",
        content: JSON.stringify(EMPTY_DOCUMENT_CONTENT),
      }),
    });
    await expect(
      migrateLegacyDocument({
        id: "mig-verify",
        ownerId: "u1",
        title: "V",
        content: EMPTY_DOCUMENT_CONTENT,
        contentAllowed: true,
      ignoredWords: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).rejects.toThrow(/round-trip verification failed/);
    decryptSpy.mockRestore();
  });

  it("create/update payloads never include plaintext title/content (E2/E3)", async () => {
    const { createDocument, updateDocumentContent } = await import(
      "@/features/documents/repository"
    );
    refSet.mockResolvedValue(undefined);
    const createdFields = await encryptedFields(
      "u1",
      "newdocid00000000001",
      "PlainTitle",
    );
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "newdocid00000000001",
      data: () => ({
        ownerId: "u1",
        ...createdFields,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });
    await createDocument({ ownerId: "u1", title: "PlainTitle" });
    const createPayload = refSet.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(createPayload).not.toHaveProperty("title");
    expect(createPayload).not.toHaveProperty("content");
    expect(JSON.stringify(createPayload)).not.toContain("PlainTitle");

    txGet.mockResolvedValueOnce(await ownedSnap());
    const after = await encryptedFields("u1", "d1", "T");
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => ({
        ownerId: "u1",
        ...after,
        updatedAt: new Date(),
      }),
    });
    await updateDocumentContent({
      documentId: "d1",
      ownerId: "u1",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    const updatePayload = txUpdate.mock.calls.at(-1)?.[1] as Record<
      string,
      unknown
    >;
    expect(updatePayload).toHaveProperty("contentCipher");
    expect(JSON.stringify(updatePayload)).not.toMatch(
      /"content"\s*:\s*"\{/,
    );
  });
});
