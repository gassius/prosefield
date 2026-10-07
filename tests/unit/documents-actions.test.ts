import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetCookieStore } from "../mocks/next-headers";
import { EMPTY_DOCUMENT_CONTENT } from "@/features/documents/schemas";
import { SessionError } from "@/features/auth/session";

const requireSession = vi.fn();
const requireActiveSubscription = vi.fn();
const createDocument = vi.fn();
const getDocumentById = vi.fn();
const updateDocumentContent = vi.fn();
const renameDocument = vi.fn();
const deleteDocument = vi.fn();

const revalidatePath = vi.fn<(path: string) => void>(() => {
  throw new Error("no request store");
});

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePath(path),
}));

vi.mock("@/features/auth/guards", () => ({
  requireSession: (...args: unknown[]) => requireSession(...args),
  requireActiveSubscription: (...args: unknown[]) =>
    requireActiveSubscription(...args),
}));

vi.mock("@/features/documents/repository", () => ({
  createDocument: (...args: unknown[]) => createDocument(...args),
  getDocumentById: (...args: unknown[]) => getDocumentById(...args),
  updateDocumentContent: (...args: unknown[]) => updateDocumentContent(...args),
  renameDocument: (...args: unknown[]) => renameDocument(...args),
  deleteDocument: (...args: unknown[]) => deleteDocument(...args),
}));

const DOC_ID = "abcABC1234567890wxyz";

describe("document actions (mocked guards)", () => {
  beforeEach(() => {
    __resetCookieStore();
    requireSession.mockReset();
    requireActiveSubscription.mockReset();
    createDocument.mockReset();
    getDocumentById.mockReset();
    updateDocumentContent.mockReset();
    renameDocument.mockReset();
    deleteDocument.mockReset();
    revalidatePath.mockReset();
    revalidatePath.mockImplementation(() => {
      throw new Error("no request store");
    });
    requireSession.mockResolvedValue({ uid: "u1", email: "a@example.com" });
    requireActiveSubscription.mockResolvedValue(undefined);
  });

  it("creates, saves, renames, deletes for the owner", async () => {
    const {
      createDocumentAction,
      saveDocumentAction,
      renameDocumentAction,
      deleteDocumentAction,
    } = await import("@/features/documents/actions");

    createDocument.mockResolvedValue({
      id: DOC_ID,
      ownerId: "u1",
      title: "Untitled document",
      content: EMPTY_DOCUMENT_CONTENT,
      contentAllowed: true,
      ignoredWords: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(createDocumentAction({})).resolves.toEqual({
      ok: true,
      data: { id: DOC_ID },
    });

    getDocumentById.mockResolvedValue({
      id: DOC_ID,
      ownerId: "u1",
      title: "Untitled document",
      content: EMPTY_DOCUMENT_CONTENT,
      contentAllowed: true,
      ignoredWords: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    updateDocumentContent.mockResolvedValue({
      id: DOC_ID,
      ownerId: "u1",
      title: "Untitled document",
      content: EMPTY_DOCUMENT_CONTENT,
      contentAllowed: true,
      ignoredWords: [],
      createdAt: new Date(),
      updatedAt: new Date("2026-10-02T12:00:00Z"),
    });
    await expect(
      saveDocumentAction({ documentId: DOC_ID, content: EMPTY_DOCUMENT_CONTENT }),
    ).resolves.toMatchObject({ ok: true, data: { id: DOC_ID } });
    expect(updateDocumentContent).toHaveBeenCalledWith({
      documentId: DOC_ID,
      ownerId: "u1",
      content: EMPTY_DOCUMENT_CONTENT,
      ignoredWords: [],
    });

    renameDocument.mockResolvedValue({
      id: DOC_ID,
      ownerId: "u1",
      title: "Renamed",
      content: EMPTY_DOCUMENT_CONTENT,
      contentAllowed: true,
      ignoredWords: [],
      createdAt: new Date(),
      updatedAt: new Date("2026-10-02T12:00:00Z"),
    });
    await expect(
      renameDocumentAction({ documentId: DOC_ID, title: "Renamed" }),
    ).resolves.toEqual({
      ok: true,
      data: {
        id: DOC_ID,
        title: "Renamed",
        updatedAt: "2026-10-02T12:00:00.000Z",
      },
    });
    expect(renameDocument).toHaveBeenCalledWith({
      documentId: DOC_ID,
      ownerId: "u1",
      title: "Renamed",
    });

    deleteDocument.mockResolvedValue(true);
    await expect(deleteDocumentAction({ documentId: DOC_ID })).resolves.toEqual({
      ok: true,
      data: { id: DOC_ID },
    });
  });

  it("calls requireSession with checkRevoked true (bites if disabled)", async () => {
    const { createDocumentAction } = await import(
      "@/features/documents/actions"
    );
    createDocument.mockResolvedValue({
      id: DOC_ID,
      ownerId: "u1",
      title: "T",
      content: EMPTY_DOCUMENT_CONTENT,
      contentAllowed: true,
      ignoredWords: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await createDocumentAction({});
    expect(requireSession).toHaveBeenCalledWith({ checkRevoked: true });
  });

  it("ignores client-supplied ownerId on create", async () => {
    const { createDocumentAction } = await import(
      "@/features/documents/actions"
    );
    createDocument.mockResolvedValue({
      id: DOC_ID,
      ownerId: "u1",
      title: "Mine",
      content: EMPTY_DOCUMENT_CONTENT,
      contentAllowed: true,
      ignoredWords: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await createDocumentAction({
      ownerId: "attacker",
      title: "Mine",
    });
    expect(createDocument).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "u1" }),
    );
    expect(createDocument).not.toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "attacker" }),
    );
  });

  it("ignores client-supplied ownerId on save", async () => {
    const { saveDocumentAction } = await import(
      "@/features/documents/actions"
    );
    getDocumentById.mockResolvedValue({
      id: DOC_ID,
      ownerId: "u1",
      title: "Mine",
      content: EMPTY_DOCUMENT_CONTENT,
      contentAllowed: true,
      ignoredWords: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    updateDocumentContent.mockResolvedValue({
      id: DOC_ID,
      ownerId: "u1",
      title: "Mine",
      content: EMPTY_DOCUMENT_CONTENT,
      contentAllowed: true,
      ignoredWords: [],
      createdAt: new Date(),
      updatedAt: new Date("2026-10-02T12:00:00Z"),
    });
    await expect(
      saveDocumentAction({
        documentId: DOC_ID,
        content: EMPTY_DOCUMENT_CONTENT,
        ownerId: "attacker",
      }),
    ).resolves.toMatchObject({ ok: true, data: { id: DOC_ID } });
    expect(updateDocumentContent).toHaveBeenCalledTimes(1);
    // Ownership for the TOCTOU-safe tx comes from the session, never the client.
    expect(updateDocumentContent).toHaveBeenCalledWith({
      documentId: DOC_ID,
      ownerId: "u1",
      content: EMPTY_DOCUMENT_CONTENT,
      ignoredWords: [],
    });
    expect(updateDocumentContent).not.toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "attacker" }),
    );
    expect(getDocumentById).toHaveBeenCalledWith(DOC_ID);
  });

  it("maps missing post-write updates and deletes to not_found", async () => {
    const { saveDocumentAction, renameDocumentAction, deleteDocumentAction } =
      await import("@/features/documents/actions");

    getDocumentById.mockResolvedValue({
      id: DOC_ID,
      ownerId: "u1",
      title: "T",
      content: EMPTY_DOCUMENT_CONTENT,
      contentAllowed: true,
      ignoredWords: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    updateDocumentContent.mockResolvedValue(null);
    await expect(
      saveDocumentAction({ documentId: DOC_ID, content: EMPTY_DOCUMENT_CONTENT }),
    ).resolves.toMatchObject({ ok: false, code: "not_found" });

    renameDocument.mockResolvedValue(null);
    await expect(
      renameDocumentAction({ documentId: DOC_ID, title: "X" }),
    ).resolves.toMatchObject({ ok: false, code: "not_found" });

    deleteDocument.mockResolvedValue(false);
    await expect(deleteDocumentAction({ documentId: DOC_ID })).resolves.toMatchObject({
      ok: false,
      code: "not_found",
    });
  });

  it("rejects foreign rename and foreign invalid body before Zod (unit)", async () => {
    const {
      saveDocumentAction,
      renameDocumentAction,
    } = await import("@/features/documents/actions");

    getDocumentById.mockResolvedValue({
      id: DOC_ID,
      ownerId: "someone-else",
      title: "Keep",
      content: EMPTY_DOCUMENT_CONTENT,
      contentAllowed: true,
      ignoredWords: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      renameDocumentAction({ documentId: DOC_ID, title: "Stolen" }),
    ).resolves.toMatchObject({ ok: false, code: "not_found" });
    expect(renameDocument).not.toHaveBeenCalled();

    await expect(
      renameDocumentAction({ documentId: DOC_ID, title: "" }),
    ).resolves.toMatchObject({ ok: false, code: "not_found" });

    await expect(
      saveDocumentAction({
        documentId: DOC_ID,
        content: { type: "codeBlock", content: [] },
      }),
    ).resolves.toMatchObject({ ok: false, code: "not_found" });
    expect(updateDocumentContent).not.toHaveBeenCalled();
  });

  it("rejects invalid zod input after owner check", async () => {
    const { renameDocumentAction } = await import(
      "@/features/documents/actions"
    );
    getDocumentById.mockResolvedValue({
      id: DOC_ID,
      ownerId: "u1",
      title: "T",
      content: EMPTY_DOCUMENT_CONTENT,
      contentAllowed: true,
      ignoredWords: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(
      renameDocumentAction({ documentId: DOC_ID, title: "" }),
    ).resolves.toMatchObject({ ok: false, code: "invalid" });
  });

  it.each([
    {
      label: "h2",
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Section" }],
          },
        ],
      },
    },
    {
      label: "h3",
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Subsection" }],
          },
        ],
      },
    },
  ])(
    "saveDocumentAction accepts a document with $label (bug 869fbe1dm)",
    async ({ content }) => {
      const { saveDocumentAction } = await import(
        "@/features/documents/actions"
      );
      getDocumentById.mockResolvedValue({
        id: DOC_ID,
        ownerId: "u1",
        title: "T",
        content: EMPTY_DOCUMENT_CONTENT,
        contentAllowed: true,
      ignoredWords: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      updateDocumentContent.mockResolvedValue({
        id: DOC_ID,
        ownerId: "u1",
        title: "T",
        content,
        contentAllowed: true,
      ignoredWords: [],
        createdAt: new Date(),
        updatedAt: new Date("2026-10-02T12:00:00Z"),
      });

      await expect(
        saveDocumentAction({ documentId: DOC_ID, content }),
      ).resolves.toMatchObject({ ok: true, data: { id: DOC_ID } });
      expect(updateDocumentContent).toHaveBeenCalledWith({
        documentId: DOC_ID,
        ownerId: "u1",
        content: expect.objectContaining({
          type: "doc",
          content: [
            expect.objectContaining({
              type: "heading",
              attrs: content.content[0].attrs,
            }),
          ],
        }),
        ignoredWords: [],
      });
    },
  );

  it("maps unexpected errors through the generic error branch", async () => {
    const { createDocumentAction } = await import(
      "@/features/documents/actions"
    );
    createDocument.mockRejectedValue(new Error("firestore down"));
    await expect(createDocumentAction({})).resolves.toMatchObject({
      ok: false,
      code: "error",
    });
  });

  it("maps SessionError unauthorized and DocumentAccessError invalid", async () => {
    const { createDocumentAction, saveDocumentAction } = await import(
      "@/features/documents/actions"
    );
    const { DocumentAccessError } = await import(
      "@/features/documents/ownership"
    );

    requireSession.mockRejectedValueOnce(
      new SessionError("Not signed in", "unauthorized"),
    );
    await expect(createDocumentAction({})).resolves.toMatchObject({
      ok: false,
      code: "unauthorized",
    });

    getDocumentById.mockImplementationOnce(() => {
      throw new DocumentAccessError("Invalid document id", "invalid");
    });
    await expect(
      saveDocumentAction({ documentId: DOC_ID, content: EMPTY_DOCUMENT_CONTENT }),
    ).resolves.toMatchObject({ ok: false, code: "invalid" });
  });

  it("accepts nullish create input and covers revalidate catch", async () => {
    const { createDocumentAction } = await import(
      "@/features/documents/actions"
    );
    createDocument.mockResolvedValue({
      id: DOC_ID,
      ownerId: "u1",
      title: "Untitled document",
      content: EMPTY_DOCUMENT_CONTENT,
      contentAllowed: true,
      ignoredWords: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(createDocumentAction(null)).resolves.toMatchObject({
      ok: true,
      data: { id: DOC_ID },
    });
    await expect(createDocumentAction(undefined)).resolves.toMatchObject({
      ok: true,
    });
  });

  it("maps SessionError forbidden from requireActiveSubscription", async () => {
    const { createDocumentAction } = await import(
      "@/features/documents/actions"
    );
    requireActiveSubscription.mockRejectedValue(
      new SessionError("Active subscription required", "forbidden"),
    );
    await expect(createDocumentAction({})).resolves.toMatchObject({
      ok: false,
      code: "forbidden",
    });
  });

  it("revalidates list and document paths when cache is available", async () => {
    const { createDocumentAction } = await import(
      "@/features/documents/actions"
    );
    revalidatePath.mockImplementation(() => {
      /* cache available */
    });
    createDocument.mockResolvedValue({
      id: DOC_ID,
      ownerId: "u1",
      title: "T",
      content: EMPTY_DOCUMENT_CONTENT,
      contentAllowed: true,
      ignoredWords: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await createDocumentAction({});
    expect(revalidatePath).toHaveBeenCalledWith("/documents");
    expect(revalidatePath).toHaveBeenCalledWith(`/documents/${DOC_ID}`);
  });
});
