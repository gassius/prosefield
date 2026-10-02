import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetCookieStore } from "../mocks/next-headers";
import { EMPTY_DOCUMENT_CONTENT } from "@/features/documents/schemas";

const requireSession = vi.fn();
const requireActiveSubscription = vi.fn();
const createDocument = vi.fn();
const getDocumentById = vi.fn();
const updateDocumentContent = vi.fn();
const renameDocument = vi.fn();
const deleteDocument = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(() => {
    throw new Error("no request store");
  }),
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
      id: "d1",
      ownerId: "u1",
      title: "Untitled document",
      content: EMPTY_DOCUMENT_CONTENT,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(createDocumentAction({})).resolves.toEqual({
      ok: true,
      data: { id: "d1" },
    });

    getDocumentById.mockResolvedValue({
      id: "d1",
      ownerId: "u1",
      title: "Untitled document",
      content: EMPTY_DOCUMENT_CONTENT,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    updateDocumentContent.mockResolvedValue({
      id: "d1",
      ownerId: "u1",
      title: "Untitled document",
      content: EMPTY_DOCUMENT_CONTENT,
      createdAt: new Date(),
      updatedAt: new Date("2026-10-02T12:00:00Z"),
    });
    await expect(
      saveDocumentAction({ documentId: "d1", content: EMPTY_DOCUMENT_CONTENT }),
    ).resolves.toMatchObject({ ok: true, data: { id: "d1" } });

    renameDocument.mockResolvedValue({
      id: "d1",
      ownerId: "u1",
      title: "Renamed",
      content: EMPTY_DOCUMENT_CONTENT,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(
      renameDocumentAction({ documentId: "d1", title: "Renamed" }),
    ).resolves.toEqual({ ok: true, data: { id: "d1", title: "Renamed" } });

    deleteDocument.mockResolvedValue(true);
    await expect(deleteDocumentAction({ documentId: "d1" })).resolves.toEqual({
      ok: true,
      data: { id: "d1" },
    });
  });

  it("maps missing post-write updates and deletes to not_found", async () => {
    const { saveDocumentAction, renameDocumentAction, deleteDocumentAction } =
      await import("@/features/documents/actions");

    getDocumentById.mockResolvedValue({
      id: "d1",
      ownerId: "u1",
      title: "T",
      content: EMPTY_DOCUMENT_CONTENT,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    updateDocumentContent.mockResolvedValue(null);
    await expect(
      saveDocumentAction({ documentId: "d1", content: EMPTY_DOCUMENT_CONTENT }),
    ).resolves.toMatchObject({ ok: false, code: "not_found" });

    renameDocument.mockResolvedValue(null);
    await expect(
      renameDocumentAction({ documentId: "d1", title: "X" }),
    ).resolves.toMatchObject({ ok: false, code: "not_found" });

    deleteDocument.mockResolvedValue(false);
    await expect(deleteDocumentAction({ documentId: "d1" })).resolves.toMatchObject({
      ok: false,
      code: "not_found",
    });
  });

  it("rejects invalid zod input", async () => {
    const { renameDocumentAction } = await import(
      "@/features/documents/actions"
    );
    await expect(
      renameDocumentAction({ documentId: "d1", title: "" }),
    ).resolves.toMatchObject({ ok: false, code: "invalid" });
  });
});
