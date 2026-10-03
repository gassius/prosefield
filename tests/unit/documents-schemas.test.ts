import { describe, expect, it } from "vitest";
import {
  ALLOWED_MARK_TYPES,
  ALLOWED_NODE_TYPES,
  assertAllowedLinkHref,
  assertAllowedTiptapJson,
  assertContentJsonDepth,
  contentValidationMessage,
  createDocumentInputSchema,
  DOCUMENT_CONTENT_MAX_BYTES,
  DOCUMENT_CONTENT_MAX_DEPTH,
  DOCUMENT_LINKS_ENABLED,
  documentContentSchema,
  documentIdSchema,
  documentTitleSchema,
  EMPTY_DOCUMENT_CONTENT,
  serialisedContentSize,
  type TiptapJson,
} from "@/features/documents/schemas";
import * as documentSchemas from "@/features/documents/schemas";

/** Nest `listNesting` bulletList wrappers around a paragraph+text leaf. */
function nestedBulletListDoc(listNesting: number): TiptapJson {
  let inner: TiptapJson = {
    type: "paragraph",
    content: [{ type: "text", text: "x" }],
  };
  for (let i = 0; i < listNesting; i += 1) {
    inner = {
      type: "bulletList",
      content: [{ type: "listItem", content: [inner] }],
    };
  }
  return { type: "doc", content: [inner] };
}

/** Build a JSON array chain whose innermost container sits at `depth` (root = 0). */
function nestedArrayChain(depth: number): unknown {
  let value: unknown = [];
  for (let i = 0; i < depth; i += 1) {
    value = [value];
  }
  return value;
}

const REPRESENTATIVE_VALID_DOCUMENT: TiptapJson = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Chapter", marks: [{ type: "bold" }] }],
    },
    {
      type: "heading",
      attrs: { level: 3 },
      content: [
        { type: "text", text: "Section", marks: [{ type: "italic" }] },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Lead-in" },
        { type: "hardBreak" },
        { type: "text", text: "continued" },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "bullet" }],
            },
          ],
        },
      ],
    },
    {
      type: "orderedList",
      attrs: { start: 1, type: null },
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "first" }],
            },
          ],
        },
      ],
    },
    {
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "quoted" }],
        },
      ],
    },
  ],
};

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
    expect(
      assertAllowedTiptapJson({
        type: "orderedList",
        attrs: { start: 3, type: "a" },
        content: [],
      }),
    ).toEqual({
      type: "orderedList",
      attrs: { start: 3, type: "a" },
      content: [],
    });
    expect(
      assertAllowedTiptapJson({
        type: "orderedList",
        attrs: { type: null },
        content: [],
      }),
    ).toEqual({ type: "orderedList", content: [] });
    expect(
      assertAllowedTiptapJson({
        type: "orderedList",
        content: [],
      }),
    ).toEqual({ type: "orderedList", content: [] });
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
        attrs: { start: 1.5 },
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
    expect(() =>
      assertAllowedTiptapJson({
        type: "orderedList",
        attrs: { start: 1, weird: true },
        content: [],
      }),
    ).toThrow(/unexpected attrs/);
    expect(() =>
      assertAllowedTiptapJson({
        type: "orderedList",
        attrs: "nope",
        content: [],
      }),
    ).toThrow(/attrs must be an object/);
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

  it("rejects link marks while links are disabled", () => {
    expect(DOCUMENT_LINKS_ENABLED).toBe(false);
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
    ).toThrow(/link marks are disabled/);
  });

  it("rejects javascript: href when links are enabled", () => {
    expect(() =>
      assertAllowedLinkHref("javascript:alert(1)"),
    ).toThrow(/scheme/);
    expect(() =>
      assertAllowedTiptapJson(
        {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "x",
                  marks: [
                    {
                      type: "link",
                      attrs: { href: "javascript:alert(1)" },
                    },
                  ],
                },
              ],
            },
          ],
        },
        "content",
        { linksEnabled: true },
      ),
    ).toThrow(/scheme/);
    expect(
      assertAllowedTiptapJson(
        {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "x",
                  marks: [
                    { type: "link", attrs: { href: "https://example.com" } },
                  ],
                },
              ],
            },
          ],
        },
        "content",
        { linksEnabled: true },
      ),
    ).toMatchObject({
      content: [
        {
          content: [
            {
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
          ],
        },
      ],
    });
    expect(assertAllowedLinkHref("mailto:a@b.test")).toBe("mailto:a@b.test");
    expect(assertAllowedLinkHref("http://example.com")).toBe(
      "http://example.com",
    );
    expect(() => assertAllowedLinkHref("")).toThrow(/required/);
    expect(() => assertAllowedLinkHref("not a url")).toThrow(/valid URL/);
    expect(() =>
      assertAllowedTiptapJson(
        {
          type: "text",
          text: "x",
          marks: [{ type: "link" }],
        },
        "content",
        { linksEnabled: true },
      ),
    ).toThrow(/requires attrs/);
    expect(() =>
      assertAllowedTiptapJson(
        {
          type: "text",
          text: "x",
          marks: [{ type: "link", attrs: "nope" }],
        },
        "content",
        { linksEnabled: true },
      ),
    ).toThrow(/link attrs must be an object/);
    expect(() =>
      assertAllowedTiptapJson(
        {
          type: "text",
          text: "x",
          marks: [{ type: "link", attrs: { href: "https://a.test", target: "_blank" } }],
        },
        "content",
        { linksEnabled: true },
      ),
    ).toThrow(/unexpected attrs on 'link'/);
  });

  it("rejects underline, codeBlock, and heading level 1", () => {
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

  it("rejects unknown attrs on heading and every other node type", () => {
    expect(() =>
      assertAllowedTiptapJson({
        type: "heading",
        attrs: { level: 2, id: "nope" },
        content: [],
      }),
    ).toThrow(/unexpected attrs on 'heading'/);

    expect(
      assertAllowedTiptapJson({
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "ok" }],
      }),
    ).toMatchObject({ type: "heading", attrs: { level: 2 } });

    for (const type of ALLOWED_NODE_TYPES) {
      if (type === "heading" || type === "orderedList") {
        continue;
      }
      expect(() =>
        assertAllowedTiptapJson({
          type,
          attrs: { unexpected: true },
          ...(type === "text" ? { text: "x" } : {}),
        }),
      ).toThrow(new RegExp(`unexpected attrs on '${type}'`));
    }

    expect(() =>
      assertAllowedTiptapJson({
        type: "orderedList",
        attrs: { start: 1, weird: true },
        content: [],
      }),
    ).toThrow(/unexpected attrs on 'orderedList'/);

    for (const mark of ALLOWED_MARK_TYPES) {
      expect(() =>
        assertAllowedTiptapJson({
          type: "text",
          text: "x",
          marks: [{ type: mark, attrs: { extra: 1 } }],
        }),
      ).toThrow(new RegExp(`unexpected attrs on '${mark}'`));
    }
  });

  it("enforces documented JSON nesting depth without unbounded recursion", () => {
    expect(DOCUMENT_CONTENT_MAX_DEPTH).toBe(32);

    // n=7 → deepest text container at depth 32 (root doc = 0).
    const atLimit = nestedBulletListDoc(7);
    expect(assertAllowedTiptapJson(atLimit).type).toBe("doc");
    expect(documentContentSchema.parse(atLimit).type).toBe("doc");
    expect(() => assertContentJsonDepth(atLimit)).not.toThrow();

    const overLimit = nestedBulletListDoc(8);
    expect(() => assertAllowedTiptapJson(overLimit)).toThrow(
      /maximum nesting depth/,
    );
    expect(() => documentContentSchema.parse(overLimit)).toThrow(
      /maximum nesting depth/,
    );

    expect(() =>
      assertContentJsonDepth(nestedArrayChain(DOCUMENT_CONTENT_MAX_DEPTH)),
    ).not.toThrow();
    expect(() =>
      assertContentJsonDepth(nestedArrayChain(DOCUMENT_CONTENT_MAX_DEPTH + 1)),
    ).toThrow(/maximum nesting depth/);

    const veryDeep = nestedArrayChain(10_000);
    expect(() => assertContentJsonDepth(veryDeep)).toThrow(
      /maximum nesting depth/,
    );
    expect(() => assertAllowedTiptapJson(veryDeep)).toThrow(
      /maximum nesting depth/,
    );
  });

  it("keeps a representative existing valid document valid", () => {
    const parsed = documentContentSchema.parse(REPRESENTATIVE_VALID_DOCUMENT);
    expect(parsed).toMatchObject({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 } },
        { type: "heading", attrs: { level: 3 } },
        { type: "paragraph" },
        { type: "bulletList" },
        { type: "orderedList", attrs: { start: 1 } },
        { type: "blockquote" },
      ],
    });
    expect(assertAllowedTiptapJson(REPRESENTATIVE_VALID_DOCUMENT).content).toHaveLength(
      6,
    );
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
    ).toThrow(/unexpected attrs on 'bold'/);
    expect(() =>
      assertAllowedTiptapJson({
        type: "text",
        text: "x",
        marks: [{ type: "italic", attrs: "nope" }],
      }),
    ).toThrow(/mark attrs must be an object/);
    expect(() =>
      assertAllowedTiptapJson({
        type: "heading",
        attrs: "nope",
      }),
    ).toThrow(/heading attrs must be an object/);
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

  it("contentValidationMessage prefers Error.message and falls back otherwise", () => {
    expect(contentValidationMessage(new Error("nope"))).toBe("nope");
    expect(contentValidationMessage("boom")).toMatch(/disallowed/i);
  });
});
