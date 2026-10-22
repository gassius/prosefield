import { describe, expect, it } from "vitest";
import { siteCopy } from "@/content/site";
import { messages } from "@/lib/messages";

/**
 * Pins centralised empty-state copy (literal check) and documents the
 * siteCopy derivation so the two stay intentionally coupled.
 */
describe("messages", () => {
  it("exposes stable empty-state strings", () => {
    expect(messages.empty.documentsTitle).toBe(
      "Your first page is waiting.",
    );
    expect(messages.empty.documentsBody).toBe(
      "Create a document to start writing.",
    );
    expect(messages.empty.spellcheckNoSuggestions).toBe("No suggestions");
  });

  it("stays aligned with siteCopy for shared keys", () => {
    expect(messages.empty.documentsTitle).toBe(siteCopy.documents.emptyTitle);
    expect(messages.empty.documentsBody).toBe(siteCopy.documents.emptyBody);
    expect(messages.empty.spellcheckNoSuggestions).toBe(
      siteCopy.documents.spellcheckNoSuggestions,
    );
  });
});
