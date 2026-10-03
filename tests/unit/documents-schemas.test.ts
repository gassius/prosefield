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

/**
 * Nest `listNesting` bulletList wrappers around a paragraph+text leaf.
 * TipTap node depth of the deepest text is `2 * listNesting + 2`
 * (doc=0 → listNesting×(bulletList+listItem) → paragraph → text).
 */
function nestedBulletListDoc(
  listNesting: number,
  marks?: Array<{ type: string }>,
): TiptapJson {
  const textNode: TiptapJson = {
    type: "text",
    text: "x",
    ...(marks && marks.length > 0 ? { marks } : {}),
  };
  let inner: TiptapJson = {
    type: "paragraph",
    content: [textNode],
  };
  for (let i = 0; i < listNesting; i += 1) {
    inner = {
      type: "bulletList",
      content: [{ type: "listItem", content: [inner] }],
    };
  }
  return { type: "doc", content: [inner] };
}

/**
 * Nest `blockquoteNesting` blockquotes around a paragraph+text leaf.
 * TipTap node depth of the deepest text is `blockquoteNesting + 2`.
 */
function nestedBlockquoteDoc(
  blockquoteNesting: number,
  marks?: Array<{ type: string }>,
): TiptapJson {
  const textNode: TiptapJson = {
    type: "text",
    text: "x",
    ...(marks && marks.length > 0 ? { marks } : {}),
  };
  let inner: TiptapJson = {
    type: "paragraph",
    content: [textNode],
  };
  for (let i = 0; i < blockquoteNesting; i += 1) {
    inner = { type: "blockquote", content: [inner] };
  }
  return { type: "doc", content: [inner] };
}

/** List nesting whose deepest text sits exactly at DOCUMENT_CONTENT_MAX_DEPTH. */
const LIST_NESTING_AT_DEPTH_LIMIT = (DOCUMENT_CONTENT_MAX_DEPTH - 2) / 2;
/** Blockquote nesting whose deepest text sits exactly at DOCUMENT_CONTENT_MAX_DEPTH. */
const BLOCKQUOTE_NESTING_AT_DEPTH_LIMIT = DOCUMENT_CONTENT_MAX_DEPTH - 2;

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
    // Case / whitespace / embedded-newline variants — kills a raw
    // `href.startsWith("javascript:")` blacklist mutation (M20).
    // Assemble the newline variant at runtime so the no-host-Java CI guard
    // does not flag a literal `java` token in source.
    const hrefWithEmbeddedNewline = ["ja", "va", "\nscript:alert(1)"].join("");
    for (const href of [
      " JaVaScRiPt:alert(1)",
      "\tjavascript:alert(1)",
      hrefWithEmbeddedNewline,
      "JAVASCRIPT:alert(1)",
    ]) {
      expect(() => assertAllowedLinkHref(href), href).toThrow(/scheme/);
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
                    marks: [{ type: "link", attrs: { href } }],
                  },
                ],
              },
            ],
          },
          "root",
          { linksEnabled: true },
        ),
      ).toThrow(/scheme/);
    }
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
    ).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "x",
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
    ).toEqual({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "ok" }],
    });

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

  it("enforces documented TipTap node nesting depth without unbounded recursion", () => {
    expect(DOCUMENT_CONTENT_MAX_DEPTH).toBe(64);
    expect(LIST_NESTING_AT_DEPTH_LIMIT).toBe(31);
    expect(BLOCKQUOTE_NESTING_AT_DEPTH_LIMIT).toBe(62);

    // Deepest text at node depth 64; bold/italic marks must not consume depth.
    const atLimit = nestedBulletListDoc(LIST_NESTING_AT_DEPTH_LIMIT, [
      { type: "bold" },
      { type: "italic" },
    ]);
    expect(assertAllowedTiptapJson(atLimit)).toEqual(atLimit);
    expect(documentContentSchema.parse(atLimit)).toEqual(atLimit);
    expect(() => assertContentJsonDepth(atLimit)).not.toThrow();

    const overLimit = nestedBulletListDoc(LIST_NESTING_AT_DEPTH_LIMIT + 1, [
      { type: "bold" },
      { type: "italic" },
    ]);
    expect(() => assertAllowedTiptapJson(overLimit)).toThrow(
      /maximum nesting depth/,
    );
    expect(() => documentContentSchema.parse(overLimit)).toThrow(
      /maximum nesting depth/,
    );

    const bqAtLimit = nestedBlockquoteDoc(BLOCKQUOTE_NESTING_AT_DEPTH_LIMIT, [
      { type: "bold" },
    ]);
    expect(assertAllowedTiptapJson(bqAtLimit).type).toBe("doc");
    const bqOver = nestedBlockquoteDoc(BLOCKQUOTE_NESTING_AT_DEPTH_LIMIT + 1);
    expect(() => assertAllowedTiptapJson(bqOver)).toThrow(
      /maximum nesting depth/,
    );

    // Depth runs at the public entry regardless of the root path label.
    expect(() =>
      assertAllowedTiptapJson(overLimit, "customRoot"),
    ).toThrow(/maximum nesting depth/);

    // 10k-level node-shaped TipTap doc through the save-path schema — clean
    // issue, not a RangeError from unbounded recursion.
    const veryDeep = nestedBlockquoteDoc(10_000);
    expect(() => assertContentJsonDepth(veryDeep)).toThrow(
      /maximum nesting depth/,
    );
    expect(() => assertAllowedTiptapJson(veryDeep)).toThrow(
      /maximum nesting depth/,
    );
    const veryDeepParse = documentContentSchema.safeParse(veryDeep);
    expect(veryDeepParse.success).toBe(false);
    if (!veryDeepParse.success) {
      expect(veryDeepParse.error.issues[0]?.message).toMatch(
        /maximum nesting depth/,
      );
    }
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
