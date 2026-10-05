/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DOCUMENT_CONTENT_MAX_DEPTH,
  EMPTY_DOCUMENT_CONTENT,
  type TiptapJson,
} from "@/features/documents/schemas";
import {
  clearAllTrialDrafts,
  clearTrialDraft,
  clearTrialDraftsNotForUid,
  readTrialDraft,
  stashTrialDraft,
  trialDraftStorageKey,
  validateTrialDraft,
} from "@/features/documents/trial-draft-stash";

function nestBlockquotes(depth: number): TiptapJson {
  let node: TiptapJson = {
    type: "paragraph",
    content: [{ type: "text", text: "deep" }],
  };
  for (let i = 0; i < depth; i += 1) {
    node = { type: "blockquote", content: [node] };
  }
  return { type: "doc", content: [node] };
}

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
    const result = stashTrialDraft("uid-a", { title: "My draft", content });
    expect(result.ok).toBe(true);
    stashTrialDraft("uid-b", {
      title: "Other",
      content: EMPTY_DOCUMENT_CONTENT,
    });

    expect(readTrialDraft("uid-a")).toEqual({
      title: "My draft",
      content,
    });
    expect(readTrialDraft("uid-b")?.title).toBe("Other");

    clearTrialDraft("uid-a");
    expect(readTrialDraft("uid-a")).toBeNull();
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
    expect(
      stashTrialDraft("", { title: "Nope", content: EMPTY_DOCUMENT_CONTENT }),
    ).toEqual({ ok: false, reason: "unavailable" });
    expect(sessionStorage.length).toBe(0);
    expect(readTrialDraft("")).toBeNull();
    clearTrialDraft("");
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

  it("validateTrialDraft normalises empty input and rejects bad shapes", () => {
    // null / non-objects coerce to {} → schema defaults.
    expect(validateTrialDraft(null)).toEqual({
      title: "Untitled document",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    expect(validateTrialDraft({ title: 1 })).toBeNull();
    expect(validateTrialDraft({ title: "Ok", content: EMPTY_DOCUMENT_CONTENT })).toEqual({
      title: "Ok",
      content: EMPTY_DOCUMENT_CONTENT,
    });
  });

  it("rejects oversize titles and too-deep content via #25 schema", () => {
    const longTitle = "x".repeat(121);
    expect(
      stashTrialDraft("uid-a", {
        title: longTitle,
        content: EMPTY_DOCUMENT_CONTENT,
      }),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(readTrialDraft("uid-a")).toBeNull();

    const tooDeep = nestBlockquotes(DOCUMENT_CONTENT_MAX_DEPTH + 1);
    expect(
      stashTrialDraft("uid-b", { title: "Deep", content: tooDeep }),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(validateTrialDraft({ title: "Deep", content: tooDeep })).toBeNull();

    sessionStorage.setItem(
      trialDraftStorageKey("uid-c"),
      JSON.stringify({ title: "Tampered", content: tooDeep }),
    );
    expect(readTrialDraft("uid-c")).toBeNull();
    expect(sessionStorage.getItem(trialDraftStorageKey("uid-c"))).toBeNull();
  });

  it("clearAllTrialDrafts removes every trial key", () => {
    stashTrialDraft("uid-a", {
      title: "A",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    stashTrialDraft("uid-b", {
      title: "B",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    clearAllTrialDrafts();
    expect(readTrialDraft("uid-a")).toBeNull();
    expect(readTrialDraft("uid-b")).toBeNull();
  });

  it("clearTrialDraftsNotForUid keeps only the active uid stash", () => {
    stashTrialDraft("uid-keep", {
      title: "Keep",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    stashTrialDraft("uid-drop", {
      title: "Drop",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    clearTrialDraftsNotForUid("uid-keep");
    expect(readTrialDraft("uid-keep")?.title).toBe("Keep");
    expect(readTrialDraft("uid-drop")).toBeNull();
  });

  it("clearTrialDraftsNotForUid with empty uid clears all drafts", () => {
    stashTrialDraft("uid-a", {
      title: "A",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    clearTrialDraftsNotForUid("");
    expect(readTrialDraft("uid-a")).toBeNull();
  });

  it("stash/read/clear no-op when sessionStorage is unavailable", () => {
    const original = globalThis.sessionStorage;
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: undefined,
    });
    expect(
      stashTrialDraft("uid-a", {
        title: "Nope",
        content: EMPTY_DOCUMENT_CONTENT,
      }),
    ).toEqual({ ok: false, reason: "unavailable" });
    expect(readTrialDraft("uid-a")).toBeNull();
    expect(() => clearTrialDraft("uid-a")).not.toThrow();
    expect(() => clearAllTrialDrafts()).not.toThrow();
    expect(() => clearTrialDraftsNotForUid("uid-a")).not.toThrow();
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: original,
    });
  });
});
