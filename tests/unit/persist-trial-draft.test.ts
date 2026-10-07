/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_DOCUMENT_CONTENT } from "@/features/documents/schemas";
import {
  clearTrialDraft,
  readTrialDraft,
  stashTrialDraft,
} from "@/features/documents/trial-draft-stash";

const createDocumentAction = vi.fn();

vi.mock("@/features/documents/actions", () => ({
  createDocumentAction: (...args: unknown[]) => createDocumentAction(...args),
}));

describe("persistStashedTrialDraft", () => {
  beforeEach(async () => {
    sessionStorage.clear();
    createDocumentAction.mockReset();
    const { __resetPersistInflightForTests } = await import(
      "@/features/documents/persist-trial-draft"
    );
    __resetPersistInflightForTests();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("returns none when no stash exists", async () => {
    const { persistStashedTrialDraft } = await import(
      "@/features/documents/persist-trial-draft"
    );
    await expect(persistStashedTrialDraft("uid-1")).resolves.toEqual({
      ok: false,
      reason: "none",
    });
    expect(createDocumentAction).not.toHaveBeenCalled();
  });

  it("creates encrypted document from stash then clears it", async () => {
    stashTrialDraft("uid-1", {
      title: "Kept draft",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "keep me" }],
          },
        ],
      },
    });
    createDocumentAction.mockResolvedValue({
      ok: true,
      data: { id: "newDocId1234567890ab" },
    });
    const { persistStashedTrialDraft } = await import(
      "@/features/documents/persist-trial-draft"
    );
    await expect(persistStashedTrialDraft("uid-1")).resolves.toEqual({
      ok: true,
      documentId: "newDocId1234567890ab",
    });
    expect(createDocumentAction).toHaveBeenCalledWith({
      title: "Kept draft",
      content: expect.objectContaining({ type: "doc" }),
      ignoredWords: [],
    });
    expect(sessionStorage.getItem("prosefield:trial-draft:uid-1")).toBeNull();
  });

  it("keeps stash when create fails", async () => {
    stashTrialDraft("uid-1", {
      title: "Fail draft",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    createDocumentAction.mockResolvedValue({
      ok: false,
      code: "forbidden",
      message: "nope",
    });
    const { persistStashedTrialDraft } = await import(
      "@/features/documents/persist-trial-draft"
    );
    await expect(persistStashedTrialDraft("uid-1")).resolves.toEqual({
      ok: false,
      reason: "create_failed",
    });
    expect(sessionStorage.getItem("prosefield:trial-draft:uid-1")).toBeTruthy();
    clearTrialDraft("uid-1");
  });

  it("keeps stash when create throws", async () => {
    stashTrialDraft("uid-1", {
      title: "Throw draft",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    createDocumentAction.mockRejectedValue(new Error("boom"));
    const { persistStashedTrialDraft } = await import(
      "@/features/documents/persist-trial-draft"
    );
    await expect(persistStashedTrialDraft("uid-1")).resolves.toEqual({
      ok: false,
      reason: "create_failed",
    });
    expect(readTrialDraft("uid-1")?.title).toBe("Throw draft");
  });

  it("dedupes concurrent persists and does not double-create after success", async () => {
    stashTrialDraft("uid-1", {
      title: "Once",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    let resolveCreate: ((value: unknown) => void) | undefined;
    createDocumentAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );
    const { persistStashedTrialDraft } = await import(
      "@/features/documents/persist-trial-draft"
    );
    const first = persistStashedTrialDraft("uid-1");
    const second = persistStashedTrialDraft("uid-1");
    expect(createDocumentAction).toHaveBeenCalledTimes(1);
    resolveCreate?.({
      ok: true,
      data: { id: "docOnce1234567890abcd" },
    });
    await expect(first).resolves.toEqual({
      ok: true,
      documentId: "docOnce1234567890abcd",
    });
    await expect(second).resolves.toEqual({
      ok: true,
      documentId: "docOnce1234567890abcd",
    });
    // Replay after clear (reload / replayed success URL).
    await expect(persistStashedTrialDraft("uid-1")).resolves.toEqual({
      ok: false,
      reason: "none",
    });
    expect(createDocumentAction).toHaveBeenCalledTimes(1);
  });
});
