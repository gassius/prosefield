/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_DOCUMENT_CONTENT } from "@/features/documents/schemas";
import {
  clearTrialDraft,
  stashTrialDraft,
} from "@/features/documents/trial-draft-stash";

const createDocumentAction = vi.fn();

vi.mock("@/features/documents/actions", () => ({
  createDocumentAction: (...args: unknown[]) => createDocumentAction(...args),
}));

describe("persistStashedTrialDraft", () => {
  beforeEach(() => {
    sessionStorage.clear();
    createDocumentAction.mockReset();
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
});
