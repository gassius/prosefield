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
      doc: () => ({
        get,
        set,
        update,
        delete: del,
        id: "new-doc-id",
      }),
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

  it("parses string, map, and invalid content; lists and mutates", async () => {
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
    expect(parsed?.content).toMatchObject({ type: "doc" });

    get.mockResolvedValueOnce({
      exists: true,
      id: "d2",
      data: () => ({
        ownerId: "u1",
        title: "Map",
        content: { type: "doc", content: [] },
        createdAt: null,
        updatedAt: null,
      }),
    });
    const mapped = await getDocumentById("d2");
    expect(mapped?.content.type).toBe("doc");

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
    expect(bad?.content).toEqual(EMPTY_DOCUMENT_CONTENT);

    get.mockResolvedValueOnce({ exists: false });
    expect(await getDocumentById("missing")).toBeNull();

    docsQueryGet.mockResolvedValueOnce({
      docs: [
        {
          id: "a",
          data: () => ({ title: "A", updatedAt: new Date("2026-02-01") }),
        },
      ],
    });
    const list = await listDocumentsForOwner("u1");
    expect(list[0]?.title).toBe("A");

    set.mockResolvedValue(undefined);
    get.mockResolvedValueOnce({
      exists: true,
      id: "new-doc-id",
      data: () => ({
        ownerId: "u1",
        title: "Untitled document",
        content: JSON.stringify(EMPTY_DOCUMENT_CONTENT),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });
    const created = await createDocument({ ownerId: "u1" });
    expect(created.id).toBe("new-doc-id");

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
  });
});
