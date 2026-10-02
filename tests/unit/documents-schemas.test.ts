import { describe, expect, it } from "vitest";
import {
  createDocumentInputSchema,
  DEFAULT_DOCUMENT_TITLE,
  DOCUMENT_CONTENT_MAX_BYTES,
  DOCUMENT_TITLE_MAX,
  documentContentSchema,
  documentTitleSchema,
  EMPTY_DOCUMENT_CONTENT,
  renameDocumentInputSchema,
  serialisedContentSize,
  updateDocumentContentInputSchema,
} from "@/features/documents/schemas";

describe("document Zod schemas and bounds", () => {
  it("trims titles and rejects empty or overlong titles", () => {
    expect(documentTitleSchema.parse("  Hello  ")).toBe("Hello");
    expect(() => documentTitleSchema.parse("   ")).toThrow();
    expect(() => documentTitleSchema.parse("")).toThrow();
    expect(() =>
      documentTitleSchema.parse("x".repeat(DOCUMENT_TITLE_MAX + 1)),
    ).toThrow();
    expect(documentTitleSchema.parse("x".repeat(DOCUMENT_TITLE_MAX))).toHaveLength(
      DOCUMENT_TITLE_MAX,
    );
  });

  it("accepts empty Tiptap JSON and rejects oversize serialised content", () => {
    expect(documentContentSchema.parse(EMPTY_DOCUMENT_CONTENT)).toEqual(
      EMPTY_DOCUMENT_CONTENT,
    );

    const oversized = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "a".repeat(DOCUMENT_CONTENT_MAX_BYTES) }],
        },
      ],
    };
    expect(serialisedContentSize(oversized)).toBeGreaterThan(
      DOCUMENT_CONTENT_MAX_BYTES,
    );
    expect(() => documentContentSchema.parse(oversized)).toThrow();
  });

  it("defaults create input title and content", () => {
    const parsed = createDocumentInputSchema.parse({});
    expect(parsed.title).toBe(DEFAULT_DOCUMENT_TITLE);
    expect(parsed.content).toEqual(EMPTY_DOCUMENT_CONTENT);
  });

  it("requires documentId for save and rename", () => {
    expect(() =>
      updateDocumentContentInputSchema.parse({
        content: EMPTY_DOCUMENT_CONTENT,
      }),
    ).toThrow();
    expect(
      updateDocumentContentInputSchema.parse({
        documentId: "abc",
        content: EMPTY_DOCUMENT_CONTENT,
      }).documentId,
    ).toBe("abc");

    expect(() =>
      renameDocumentInputSchema.parse({ title: "Ok" }),
    ).toThrow();
    expect(
      renameDocumentInputSchema.parse({ documentId: "abc", title: " Renamed " })
        .title,
    ).toBe("Renamed");
  });
});
