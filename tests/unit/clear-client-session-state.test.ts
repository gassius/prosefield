/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearClientSessionState } from "@/features/auth/clear-client-session-state";
import { EMPTY_DOCUMENT_CONTENT } from "@/features/documents/schemas";
import {
  readTrialDraft,
  stashTrialDraft,
} from "@/features/documents/trial-draft-stash";

describe("clearClientSessionState", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("clears every uid-scoped trial draft (sign-out helper for #29 plug-in)", () => {
    stashTrialDraft("uid-a", {
      title: "A",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    stashTrialDraft("uid-b", {
      title: "B",
      content: EMPTY_DOCUMENT_CONTENT,
    });
    clearClientSessionState();
    expect(readTrialDraft("uid-a")).toBeNull();
    expect(readTrialDraft("uid-b")).toBeNull();
  });
});
