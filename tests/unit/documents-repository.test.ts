import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_DOCUMENT_CONTENT } from "@/features/documents/schemas";

const get = vi.fn();
const set = vi.fn();
const update = vi.fn();
const del = vi.fn();
const docsQueryGet = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: () => ({
    collection: () => ({
      doc: (documentPath?: string) => {
        // Mirror Admin SDK: document ids cannot contain `/` or be `.` / `..`.
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
          get,
          set,
          update,
          delete: del,
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

describe("documents repository", () => {
  beforeEach(() => {
    get.mockReset();
    set.mockReset();
    update.mockReset();
    del.mockReset();
    docsQueryGet.mockReset();
  });

  it("parses string, map, invalid JSON, and non-object content", async () => {
    const { getDocumentById, listDocumentsForOwner, createDocument, updateDocumentContent, renameDocument, deleteDocument } =
      await import("@/features/documents/repository");

    get.mockResolvedValueOnce({
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

    get.mockResolvedValueOnce({
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

    get.mockResolvedValueOnce({
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

    get.mockResolvedValueOnce({
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

    get.mockResolvedValueOnce({
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

    get.mockResolvedValueOnce({
      exists: true,
      id: "d6",
      data: () => ({
        ownerId: "u1",
        title: 99,
        content: JSON.stringify(EMPTY_DOCUMENT_CONTENT),
        // Duck-typed toDate is not Timestamp/Date — parseTimestamp falls to epoch.
        createdAt: { toDate: () => new Date("2026-03-01") },
        updatedAt: { toDate: () => new Date("2026-03-02") },
      }),
    });
    const coerced = await getDocumentById("d6");
    expect(coerced?.title).toBe("Untitled document");
    expect(coerced?.createdAt.toISOString()).toBe("1970-01-01T00:00:00.000Z");

    const { Timestamp } = await import("firebase-admin/firestore");
    get.mockResolvedValueOnce({
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

    set.mockResolvedValue(undefined);
    get.mockResolvedValueOnce({
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

    get.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: "u1" }) });
    get.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => ({
        ownerId: "u1",
        title: "T",
        content: JSON.stringify(EMPTY_DOCUMENT_CONTENT),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });
    update.mockResolvedValue(undefined);
    await updateDocumentContent({
      documentId: "d1",
      content: EMPTY_DOCUMENT_CONTENT,
    });

    get.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: "u1" }) });
    get.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => ({
        ownerId: "u1",
        title: "Renamed",
        content: JSON.stringify(EMPTY_DOCUMENT_CONTENT),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });
    await renameDocument({ documentId: "d1", title: "Renamed" });

    get.mockResolvedValueOnce({ exists: false });
    expect(await updateDocumentContent({ documentId: "x", content: EMPTY_DOCUMENT_CONTENT })).toBeNull();
    get.mockResolvedValueOnce({ exists: false });
    expect(await renameDocument({ documentId: "x", title: "Y" })).toBeNull();

    get.mockResolvedValueOnce({ exists: true });
    del.mockResolvedValue(undefined);
    expect(await deleteDocument("d1")).toBe(true);
    get.mockResolvedValueOnce({ exists: false });
    expect(await deleteDocument("missing")).toBe(false);

    // createDocument title/content branches + post-write empty snapshot fallbacks
    set.mockResolvedValue(undefined);
    get.mockResolvedValueOnce({
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

    get.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => ({ ownerId: "u1" }),
    });
    get.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => undefined,
    });
    update.mockResolvedValue(undefined);
    const updatedEmpty = await updateDocumentContent({
      documentId: "d1",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    // Empty snapshot falls back to {} → contentAllowed false (no stored content).
    expect(updatedEmpty?.contentAllowed).toBe(false);
    expect(updatedEmpty?.title).toBe("Untitled document");

    get.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => ({ ownerId: "u1" }),
    });
    get.mockResolvedValueOnce({
      exists: true,
      id: "d1",
      data: () => undefined,
    });
    const renamedEmpty = await renameDocument({
      documentId: "d1",
      title: "After",
    });
    expect(renamedEmpty?.title).toBe("Untitled document");

    get.mockResolvedValueOnce({
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

    get.mockResolvedValueOnce({ exists: false });
    expect(await getDocumentById("missing-doc-id-0001")).toBeNull();

    get.mockResolvedValueOnce({
      exists: true,
      id: "d9",
      data: () => undefined,
    });
    const emptySnap = await getDocumentById("d9");
    expect(emptySnap?.title).toBe("Untitled document");
    expect(emptySnap?.contentAllowed).toBe(false);
  });

  it("rejects Firestore-illegal document ids (page must validate first)", async () => {
    const { getDocumentById } = await import(
      "@/features/documents/repository"
    );
    // Bite for finding 14: without documentIdSchema → notFound(), looking up
    // "a/b" throws (Admin path rules) instead of a clean 404.
    await expect(getDocumentById("a/b")).rejects.toThrow(/documentPath|a\/b/);
    await expect(getDocumentById("..")).rejects.toThrow(/documentPath|\.\./);
  });
});
