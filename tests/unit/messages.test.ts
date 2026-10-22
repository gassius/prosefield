import { describe, expect, it } from "vitest";
import { siteCopy } from "@/content/site";
import { messages } from "@/lib/messages";

/**
 * Pins centralised error / empty-state copy and guards against drift from
 * the matching siteCopy keys still used elsewhere.
 */
describe("messages", () => {
  it("exposes stable error strings", () => {
    expect(messages.errors.network).toBe(
      "Something went wrong. Please try again.",
    );
    expect(messages.errors.saveFailed).toBe("Save failed. Try again.");
    expect(messages.errors.signOut).toBe(
      "We couldn't sign you out. Please try again.",
    );
  });

  it("exposes stable empty-state strings", () => {
    expect(messages.empty.documentsTitle).toBe(
      "Your first page is waiting.",
    );
    expect(messages.empty.documentsBody).toBe(
      "Create a document to start writing.",
    );
    expect(messages.empty.notFoundTitle).toBe("Page not found");
    expect(messages.empty.notFoundBody).toBe(
      "That page isn’t here. Head home to keep writing.",
    );
    expect(messages.empty.spellcheckNoSuggestions).toBe("No suggestions");
  });

  it("stays aligned with siteCopy for shared keys", () => {
    expect(messages.errors.network).toBe(siteCopy.auth.networkError);
    expect(messages.errors.saveFailed).toBe(siteCopy.documents.saveFailed);
    expect(messages.errors.signOut).toBe(siteCopy.auth.signOutError);
    expect(messages.empty.documentsTitle).toBe(siteCopy.documents.emptyTitle);
    expect(messages.empty.documentsBody).toBe(siteCopy.documents.emptyBody);
    expect(messages.empty.notFoundTitle).toBe(siteCopy.notFound.title);
    expect(messages.empty.notFoundBody).toBe(siteCopy.notFound.body);
    expect(messages.empty.spellcheckNoSuggestions).toBe(
      siteCopy.documents.spellcheckNoSuggestions,
    );
  });
});
