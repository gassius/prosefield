import { describe, expect, it } from "vitest";
import {
  assertAllowedTiptapJson,
  createDocumentInputSchema,
  DOCUMENT_CONTENT_MAX_BYTES,
  documentContentSchema,
  documentIdSchema,
  documentTitleSchema,
  EMPTY_DOCUMENT_CONTENT,
  serialisedContentSize,
} from "@/features/documents/schemas";
import * as documentSchemas from "@/features/documents/schemas";

describe("document allow-list and bounds", () => {
  it("accepts documents with h2 and with h3 (bug 869fbe1dm)", () => {
    const withH2 = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Section" }],
        },
      ],
    };
    const withH3 = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Subsection" }],
        },
      ],
    };
    expect(documentContentSchema.parse(withH2)).toMatchObject({
      content: [{ type: "heading", attrs: { level: 2 } }],
    });
    expect(documentContentSchema.parse(withH3)).toMatchObject({
      content: [{ type: "heading", attrs: { level: 3 } }],
    });
    expect(assertAllowedTiptapJson(withH2).content?.[0]).toMatchObject({
      type: "heading",
      attrs: { level: 2 },
    });
    expect(assertAllowedTiptapJson(withH3).content?.[0]).toMatchObject({
      type: "heading",
      attrs: { level: 3 },
    });
  });

  it("rejects unsupported heading levels and unknown nodes (keep bounds strict)", () => {
    expect(() =>
      assertAllowedTiptapJson({
        type: "doc",
        content: [{ type: "heading", attrs: { level: 1 }, content: [] }],
      }),
    ).toThrow(/heading level/);
    expect(() =>
      assertAllowedTiptapJson({
        type: "doc",
        content: [{ type: "heading", attrs: { level: 4 }, content: [] }],
      }),
    ).toThrow(/heading level/);
    expect(() =>
      assertAllowedTiptapJson({
        type: "doc",
        content: [{ type: "heading", attrs: { level: 2.5 }, content: [] }],
      }),
    ).toThrow(/heading level/);
    expect(() =>
      assertAllowedTiptapJson({
        type: "doc",
        content: [{ type: "horizontalRule" }],
      }),
    ).toThrow(/not allowed/);
  });

  it("accepts TipTap orderedList attrs (start + type null) the editor emits", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "orderedList",
          attrs: { start: 1, type: null },
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "one" }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(documentContentSchema.parse(doc)).toMatchObject({
      content: [{ type: "orderedList", attrs: { start: 1 } }],
    });
    expect(() =>
      assertAllowedTiptapJson({
        type: "orderedList",
        attrs: { start: 0 },
        content: [],
      }),
    ).toThrow(/start/);
    expect(() =>
      assertAllowedTiptapJson({
        type: "orderedList",
        attrs: { start: 1, type: "decimal" },
        content: [],
      }),
    ).toThrow(/type/);
  });

  it("plainTiptapJson clones null-prototype attrs for Server Actions", () => {
    const nullProtoAttrs = Object.assign(Object.create(null), { level: 2 });
    const raw = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: nullProtoAttrs,
          content: [{ type: "text", text: "H2" }],
        },
      ],
    };
    expect(Object.getPrototypeOf(raw.content[0].attrs)).toBeNull();
    expect(documentSchemas).toHaveProperty("plainTiptapJson");
    const plainTiptapJson = (
      documentSchemas as typeof documentSchemas & {
        plainTiptapJson: (value: unknown) => {
          content?: Array<{ type?: string; attrs?: { level?: number } }>;
        };
      }
    ).plainTiptapJson;
    const plain = plainTiptapJson(raw);
    expect(Object.getPrototypeOf(plain.content?.[0]?.attrs ?? {})).toBe(
      Object.prototype,
    );
    expect(plain.content?.[0]).toMatchObject({
      type: "heading",
      attrs: { level: 2 },
    });
    expect(documentContentSchema.safeParse(plain).success).toBe(true);
  });

  it("rejects link, underline, codeBlock, and heading level 1", () => {
    expect(() =>
      assertAllowedTiptapJson({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "x",
                marks: [{ type: "link", attrs: { href: "https://x.test" } }],
              },
            ],
          },
        ],
      }),
    ).toThrow(/link/);

    expect(() =>
      assertAllowedTiptapJson({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "x", marks: [{ type: "underline" }] },
            ],
          },
        ],
      }),
    ).toThrow(/underline/);

    expect(() =>
      assertAllowedTiptapJson({
        type: "doc",
        content: [{ type: "codeBlock", content: [] }],
      }),
    ).toThrow(/codeBlock/);

    expect(() =>
      assertAllowedTiptapJson({
        type: "doc",
        content: [{ type: "heading", attrs: { level: 1 }, content: [] }],
      }),
    ).toThrow(/heading level/);
  });

  it("accepts the full allow-list including hardBreak, lists, quote, bold, italic", () => {
    const doc = assertAllowedTiptapJson({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "H2", marks: [{ type: "bold" }] }],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "H3", marks: [{ type: "italic" }] }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "a" },
            { type: "hardBreak" },
            { type: "text", text: "b" },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "•" }] }],
            },
          ],
        },
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "1" }] }],
            },
          ],
        },
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "q" }] }],
        },
      ],
    });
    expect(doc.content?.length).toBe(6);
  });

  it("rejects malformed nodes, marks, and attrs", () => {
    expect(() => assertAllowedTiptapJson(null)).toThrow(/object/);
    expect(() => assertAllowedTiptapJson({ type: "doc", content: "nope" })).toThrow(
      /content must be an array/,
    );
    expect(() =>
      assertAllowedTiptapJson({
        type: "paragraph",
        attrs: { weird: true },
      }),
    ).toThrow(/unexpected attrs/);
    expect(() =>
      assertAllowedTiptapJson({ type: "text" }),
    ).toThrow(/text node requires/);
    expect(() =>
      assertAllowedTiptapJson({
        type: "text",
        text: "x",
        marks: "nope",
      }),
    ).toThrow(/marks must be an array/);
    expect(() =>
      assertAllowedTiptapJson({
        type: "text",
        text: "x",
        marks: [null],
      }),
    ).toThrow(/invalid mark/);
    expect(() =>
      assertAllowedTiptapJson({
        type: "text",
        text: "x",
        marks: [{ type: "bold", attrs: { extra: 1 } }],
      }),
    ).toThrow(/unexpected mark attrs/);
    expect(() =>
      assertAllowedTiptapJson({
        type: "text",
        text: "x",
        content: [],
      }),
    ).toThrow(/cannot have content/);
    expect(() =>
      assertAllowedTiptapJson({
        type: "hardBreak",
        content: [],
      }),
    ).toThrow(/leaf node/);
    expect(() =>
      assertAllowedTiptapJson({
        type: "heading",
        attrs: { level: 4 },
      }),
    ).toThrow(/heading level/);
  });

  it("defaults empty doc content when doc has no content array", () => {
    expect(assertAllowedTiptapJson({ type: "doc" })).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });

  it("rejects title of 121 characters with a literal (not the constant)", () => {
    const ok120 = "a".repeat(120);
    const bad121 = "a".repeat(121);
    expect(documentTitleSchema.parse(ok120)).toHaveLength(120);
    expect(() => documentTitleSchema.parse(bad121)).toThrow();
    expect(bad121).toHaveLength(121);
    expect(ok120).toHaveLength(120);
  });

  it("rejects empty title and path-like document ids", () => {
    expect(() => documentTitleSchema.parse("")).toThrow();
    expect(() => documentTitleSchema.parse("   ")).toThrow();
    expect(documentIdSchema.parse("abcXYZ0123456789")).toBe("abcXYZ0123456789");
    expect(() => documentIdSchema.parse("a/b")).toThrow();
    expect(() => documentIdSchema.parse("../x")).toThrow();
    expect(() => documentIdSchema.parse("has space")).toThrow();
  });

  it("measures content size in UTF-8 bytes, not JS string length", () => {
    const multibyte = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "é".repeat(300_000) }],
        },
      ],
    };
    const charLength = JSON.stringify(multibyte).length;
    const byteLength = serialisedContentSize(multibyte);
    expect(charLength).toBeLessThan(DOCUMENT_CONTENT_MAX_BYTES);
    expect(byteLength).toBeGreaterThan(DOCUMENT_CONTENT_MAX_BYTES);
    expect(() => documentContentSchema.parse(multibyte)).toThrow();
  });

  it("accepts empty allow-listed content and create defaults", () => {
    expect(documentContentSchema.parse(EMPTY_DOCUMENT_CONTENT)).toEqual(
      EMPTY_DOCUMENT_CONTENT,
    );
    expect(createDocumentInputSchema.parse({})).toMatchObject({
      title: "Untitled document",
    });
    expect(() =>
      documentContentSchema.parse({ type: "doc", content: [{ type: "codeBlock" }] }),
    ).toThrow();
  });

  it("accepts empty attrs objects and strips them from the result", () => {
    const doc = assertAllowedTiptapJson({
      type: "doc",
      content: [{ type: "paragraph", attrs: {} }],
    });
    expect(doc.content?.[0]).toEqual({ type: "paragraph" });
  });

  it("tiptapJsonSchema rejects disallow-listed JSON", async () => {
    const { tiptapJsonSchema } = await import("@/features/documents/schemas");
    expect(tiptapJsonSchema.safeParse({ type: "codeBlock" }).success).toBe(false);
    expect(
      tiptapJsonSchema.safeParse({
        type: "doc",
        content: [{ type: "paragraph" }],
      }).success,
    ).toBe(true);
  });

  it("documentContentSchema surfaces allow-list rejection messages", () => {
    const result = documentContentSchema.safeParse({ type: "horizontalRule" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/not allowed|disallowed/i);
    }
  });
});
