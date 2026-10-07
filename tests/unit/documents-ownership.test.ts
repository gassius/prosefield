import { describe, expect, it } from "vitest";
import {
  canAccessDocument,
  DocumentAccessError,
  requireOwner,
} from "@/features/documents/ownership";
import type { DocumentRecord } from "@/features/documents/repository";
import { EMPTY_DOCUMENT_CONTENT } from "@/features/documents/schemas";

function doc(ownerId: string): DocumentRecord {
  return {
    id: "d1",
    ownerId,
    title: "T",
    content: { ...EMPTY_DOCUMENT_CONTENT },
    contentAllowed: true,
      ignoredWords: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("requireOwner / canAccessDocument", () => {
  it("returns the document when uid matches", () => {
    expect(requireOwner(doc("u1"), "u1").id).toBe("d1");
    expect(canAccessDocument(doc("u1"), "u1")).toBe(true);
  });

  it("throws not_found for null and non-owner (never distinct 403)", () => {
    expect(() => requireOwner(null, "u1")).toThrow(DocumentAccessError);
    expect(canAccessDocument(null, "u1")).toBe(false);
    expect(canAccessDocument(doc("other"), "u1")).toBe(false);
    try {
      requireOwner(doc("other"), "u1");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentAccessError);
      expect((error as DocumentAccessError).code).toBe("not_found");
    }
  });
});
