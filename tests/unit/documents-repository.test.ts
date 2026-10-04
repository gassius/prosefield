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

    // Legacy plaintext map content — triggers lazy migrate transaction.
    txGet.mockResolvedValueOnce({
      exists: true,
      id: "d2",
      data: () => ({
        ownerId: "u1",
        title: "Map",
        content: { type: "doc", content: [{ type: "paragraph" }] },
      }),
    });
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
    expect(txUpdate).toHaveBeenCalled();

    txGet.mockResolvedValueOnce({
      exists: true,
      id: "d3",
      data: () => ({
        ownerId: "u1",
        title: "Bad",
        content: "{not-json",
      }),
    });
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

    txGet.mockResolvedValueOnce({
      exists: true,
      id: "d4",
      data: () => ({ ownerId: "u1", title: "Nullish", content: 42 }),
    });
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

    txGet.mockResolvedValueOnce({
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
});
