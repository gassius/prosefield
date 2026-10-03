import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_DOCUMENT_CONTENT } from "@/features/documents/schemas";

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
      doc: () => ({
        get: refGet,
        set: refSet,
        update: refUpdate,
        delete: refDelete,
        id: "newdocid00000000001",
      }),
      where: () => ({
        orderBy: () => ({
          get: docsQueryGet,
        }),
      }),
    }),
  }),
}));

function ownedSnap(overrides: Record<string, unknown> = {}) {
  return {
    exists: true,
    id: "d1",
    data: () => ({
      ownerId: "u1",
      title: "T",
      content: JSON.stringify(EMPTY_DOCUMENT_CONTENT),
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

  it("parses string, map, invalid JSON, and non-object content", async () => {
    const { getDocumentById, listDocumentsForOwner, createDocument, deleteDocument } =
      await import("@/features/documents/repository");

    refGet.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => ({
        ownerId: "u1",
        title: "T",
        content: JSON.stringify({
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
        }),
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
      }),
    });
    const parsed = await getDocumentById("d1");
    expect(parsed?.contentAllowed).toBe(true);
    expect(parsed?.content).toMatchObject({ type: "doc" });

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

    refGet.mockResolvedValueOnce({
      exists: true,
      id: "d6",
      data: () => ({
        ownerId: "u1",
        title: 99,
        content: JSON.stringify(EMPTY_DOCUMENT_CONTENT),
        createdAt: { toDate: () => new Date("2026-03-01") },
        updatedAt: { toDate: () => new Date("2026-03-02") },
      }),
    });
    const coerced = await getDocumentById("d6");
    expect(coerced?.title).toBe("Untitled document");
    expect(coerced?.createdAt.toISOString()).toBe("1970-01-01T00:00:00.000Z");

    const { Timestamp } = await import("firebase-admin/firestore");
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "d7",
      data: () => ({
        ownerId: "u1",
        title: "Stamped",
        content: JSON.stringify(EMPTY_DOCUMENT_CONTENT),
        createdAt: Timestamp.fromDate(new Date("2026-04-01T00:00:00Z")),
        updatedAt: Timestamp.fromDate(new Date("2026-04-02T00:00:00Z")),
      }),
    });
    const stamped = await getDocumentById("d7");
    expect(stamped?.createdAt.toISOString()).toContain("2026-04-01");
    expect(stamped?.title).toBe("Stamped");

    docsQueryGet.mockResolvedValueOnce({
      docs: [
        {
          id: "a",
          data: () => ({ title: "A", updatedAt: new Date("2026-02-01") }),
        },
        {
          id: "b",
          data: () => ({ updatedAt: new Date("2026-02-01") }),
        },
      ],
    });
    const list = await listDocumentsForOwner("u1");
    expect(list[0]?.title).toBe("A");
    expect(list[1]?.title).toBe("Untitled document");

    refSet.mockResolvedValue(undefined);
    refGet.mockResolvedValueOnce({
      exists: true,
      id: "newdocid00000000001",
      data: () => ({
        ownerId: "u1",
        title: "Untitled document",
        content: JSON.stringify(EMPTY_DOCUMENT_CONTENT),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });
    const created = await createDocument({ ownerId: "u1" });
    expect(created.id).toBe("newdocid00000000001");
    expect(created.contentAllowed).toBe(true);

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

    refGet.mockResolvedValueOnce({
      exists: true,
      id: "d8",
      data: () => ({
        ownerId: 42,
        title: "No owner string",
        content: JSON.stringify(EMPTY_DOCUMENT_CONTENT),
        createdAt: new Date("2026-05-01"),
        updatedAt: new Date("2026-05-02"),
      }),
    });
    const noOwner = await getDocumentById("d8");
    expect(noOwner?.ownerId).toBe("");

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

    const { __unsafeSetDocumentContentForTests } = await import(
      "@/features/documents/repository"
    );
    refUpdate.mockResolvedValue(undefined);
    await __unsafeSetDocumentContentForTests({
      documentId: "d1",
      contentJson: '{"type":"doc","content":[]}',
    });
    expect(refUpdate).toHaveBeenCalled();
  });

  it("updateDocumentContent uses tx.get/tx.update with ownership inside the transaction", async () => {
    const { updateDocumentContent } = await import(
      "@/features/documents/repository"
    );

    txGet.mockResolvedValueOnce(ownedSnap());
    // Also arm ref spies so tx→ref mutations fail on assertion, not TypeError.
    refGet.mockResolvedValue(ownedSnap());
    refUpdate.mockResolvedValue(undefined);
    const afterUpdate = await updateDocumentContent({
      documentId: "d1",
      ownerId: "u1",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    expect(afterUpdate?.contentAllowed).toBe(true);
    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(txGet).toHaveBeenCalledTimes(1);
    expect(txUpdate).toHaveBeenCalledTimes(1);
    // Mutations 9a/9b: writing or reading via ref.* must fail these.
    expect(refGet).not.toHaveBeenCalled();
    expect(refUpdate).not.toHaveBeenCalled();

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

    txGet.mockResolvedValueOnce(ownedSnap({ ownerId: "other" }));
    expect(
      await updateDocumentContent({
        documentId: "d1",
        ownerId: "u1",
        content: EMPTY_DOCUMENT_CONTENT,
      }),
    ).toBeNull();
    expect(txUpdate).toHaveBeenCalledTimes(1);
    expect(refUpdate).not.toHaveBeenCalled();

    txGet.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => ({ ownerId: "u1" }),
    });
    const updatedSparse = await updateDocumentContent({
      documentId: "d1",
      ownerId: "u1",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    expect(updatedSparse?.contentAllowed).toBe(true);
    expect(updatedSparse?.title).toBe("Untitled document");
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
    // empty data → ownerId undefined !== "u1"
    expect(updatedEmptyData).toBeNull();
    expect(refUpdate).not.toHaveBeenCalled();
  });

  it("renameDocument uses tx.get/tx.update with ownership inside the transaction", async () => {
    const { renameDocument } = await import("@/features/documents/repository");

    txGet.mockResolvedValueOnce(ownedSnap());
    refGet.mockResolvedValue(ownedSnap());
    refUpdate.mockResolvedValue(undefined);
    const afterRename = await renameDocument({
      documentId: "d1",
      ownerId: "u1",
      title: "Renamed",
    });
    expect(afterRename?.title).toBe("Renamed");
    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(txGet).toHaveBeenCalledTimes(1);
    expect(txUpdate).toHaveBeenCalledTimes(1);
    // Mutation 9c (plain get/update shim) must fail these.
    expect(refGet).not.toHaveBeenCalled();
    expect(refUpdate).not.toHaveBeenCalled();

    txGet.mockResolvedValueOnce({ exists: false });
    expect(
      await renameDocument({ documentId: "x", ownerId: "u1", title: "Y" }),
    ).toBeNull();
    expect(refUpdate).not.toHaveBeenCalled();

    txGet.mockResolvedValueOnce(ownedSnap({ ownerId: "other" }));
    expect(
      await renameDocument({ documentId: "d1", ownerId: "u1", title: "Nope" }),
    ).toBeNull();
    expect(txUpdate).toHaveBeenCalledTimes(1);
    expect(refUpdate).not.toHaveBeenCalled();

    txGet.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => ({ ownerId: "u1" }),
    });
    const renamedSparse = await renameDocument({
      documentId: "d1",
      ownerId: "u1",
      title: "After",
    });
    expect(renamedSparse?.title).toBe("After");
    expect(refUpdate).not.toHaveBeenCalled();
  });
});
