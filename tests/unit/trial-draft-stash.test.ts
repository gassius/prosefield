/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EMPTY_DOCUMENT_CONTENT } from "@/features/documents/schemas";
import {
  clearTrialDraft,
  hasTrialDraft,
  readTrialDraft,
  stashTrialDraft,
  trialDraftStorageKey,
} from "@/features/documents/trial-draft-stash";

describe("trial draft stash (uid-scoped sessionStorage)", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("keys storage by uid", () => {
    expect(trialDraftStorageKey("uid-a")).toBe("prosefield:trial-draft:uid-a");
    expect(trialDraftStorageKey("uid-b")).not.toBe(trialDraftStorageKey("uid-a"));
  });

  it("stashes, reads, and clears per uid without leaking across users", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "hello trial" }],
        },
      ],
    };
    stashTrialDraft("uid-a", { title: "My draft", content });
    stashTrialDraft("uid-b", {
      title: "Other",
      content: EMPTY_DOCUMENT_CONTENT,
    });

    expect(readTrialDraft("uid-a")).toEqual({
      title: "My draft",
      content,
    });
    expect(readTrialDraft("uid-b")?.title).toBe("Other");
    expect(hasTrialDraft("uid-a")).toBe(true);

    clearTrialDraft("uid-a");
    expect(readTrialDraft("uid-a")).toBeNull();
    expect(hasTrialDraft("uid-a")).toBe(false);
    expect(readTrialDraft("uid-b")?.title).toBe("Other");
  });

  it("rejects malformed stash JSON", () => {
    sessionStorage.setItem(trialDraftStorageKey("uid-x"), "{not-json");
    expect(readTrialDraft("uid-x")).toBeNull();
    sessionStorage.setItem(
      trialDraftStorageKey("uid-x"),
      JSON.stringify({ title: 1, content: null }),
    );
    expect(readTrialDraft("uid-x")).toBeNull();
  });

  it("defaults blank titles to Untitled document", () => {
    stashTrialDraft("uid-a", { title: "   ", content: EMPTY_DOCUMENT_CONTENT });
    expect(readTrialDraft("uid-a")?.title).toBe("Untitled document");
  });

  it("no-ops for empty uid", () => {
    stashTrialDraft("", { title: "Nope", content: EMPTY_DOCUMENT_CONTENT });
    expect(sessionStorage.length).toBe(0);
    expect(readTrialDraft("")).toBeNull();
    clearTrialDraft("");
    expect(hasTrialDraft("")).toBe(false);
  });

  it("defaults missing content and blank stored titles on read", () => {
    stashTrialDraft("uid-a", {
      title: "Has content",
      content: undefined as unknown as typeof EMPTY_DOCUMENT_CONTENT,
    });
    expect(readTrialDraft("uid-a")?.content).toEqual(EMPTY_DOCUMENT_CONTENT);

    sessionStorage.setItem(
      trialDraftStorageKey("uid-b"),
      JSON.stringify({ title: "   ", content: EMPTY_DOCUMENT_CONTENT }),
    );
    expect(readTrialDraft("uid-b")?.title).toBe("Untitled document");
  });
});
