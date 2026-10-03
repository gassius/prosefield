import { z } from "zod";

/** Title: trimmed, 1–120 characters (Architecture §8). */
export const DOCUMENT_TITLE_MIN = 1;
export const DOCUMENT_TITLE_MAX = 120;

/** Content: serialised Tiptap JSON ≤ 512 KiB (Architecture §8). */
export const DOCUMENT_CONTENT_MAX_BYTES = 512 * 1024;

/**
 * Maximum TipTap *node* nesting depth (not raw JSON containers).
 *
 * Root `doc` is depth 0; each child in a node's `content` array is depth+1.
 * Marks and attrs are not counted — they are bounded by the allow-lists
 * ({@link ALLOWED_MARK_ATTR_KEYS}, {@link ALLOWED_NODE_ATTR_KEYS}).
 * Checked iteratively (stack) so over-deep input cannot blow the call stack.
 *
 * Choice (a): count TipTap node nesting, not JSON object/array containers.
 * Every list level is two nodes (`bulletList`/`orderedList` + `listItem`), then
 * `paragraph` + `text`, so depth 64 ≈ 31 nested list levels. Bold/italic on the
 * deepest text do not consume depth. Cap is well above realistic editor nesting
 * while still bounding adversarial payloads.
 */
export const DOCUMENT_CONTENT_MAX_DEPTH = 64;

export const DEFAULT_DOCUMENT_TITLE = "Untitled document";

/**
 * Firestore auto-ids are 20 alphanumerics; reject path separators / traversal.
 * Architecture §9: URL parameters are untrusted.
 */
export const DOCUMENT_ID_PATTERN = /^[A-Za-z0-9]{1,128}$/;

/**
 * Spec allow-list (Architecture §5.5 / Art Direction): paragraph, H2, H3,
 * bullet/ordered lists, blockquote, bold, italic, history (client-only).
 * hardBreak is kept — Shift+Enter soft breaks inside a paragraph; it is not
 * a formatting mark and matches StarterKit's writing defaults without adding
 * a toolbar control.
 */
export const ALLOWED_NODE_TYPES = [
  "doc",
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "text",
  "hardBreak",
] as const;

export const ALLOWED_MARK_TYPES = ["bold", "italic"] as const;

/**
 * Links are disabled in the editor (`prosefieldStarterKitOptions.link: false`).
 * While false, link marks are rejected. When enabled, only safe href schemes
 * in {@link ALLOWED_LINK_HREF_SCHEMES} are accepted.
 */
export const DOCUMENT_LINKS_ENABLED = false;

/** Allowed `href` schemes if/when {@link DOCUMENT_LINKS_ENABLED} is true. */
export const ALLOWED_LINK_HREF_SCHEMES = ["http:", "https:", "mailto:"] as const;

export const ALLOWED_HEADING_LEVELS = [2, 3] as const;

/** HTML `ol` type values TipTap's OrderedList may emit (plus null default). */
export const ALLOWED_ORDERED_LIST_TYPES = ["1", "a", "A", "i", "I"] as const;

/** Attr keys allowed per node type; all others are rejected. */
export const ALLOWED_NODE_ATTR_KEYS: Readonly<
  Record<(typeof ALLOWED_NODE_TYPES)[number], readonly string[]>
> = {
  doc: [],
  paragraph: [],
  heading: ["level"],
  bulletList: [],
  orderedList: ["start", "type"],
  listItem: [],
  blockquote: [],
  text: [],
  hardBreak: [],
};

/** Attr keys allowed per mark type; all others are rejected. */
export const ALLOWED_MARK_ATTR_KEYS: Readonly<Record<string, readonly string[]>> =
  {
    bold: [],
    italic: [],
    link: ["href"],
  };

/**
 * Attr keys `assertAllowedTiptapJson` deliberately handles.
 * Drift tests compare TipTap `getSchema` attrs against this map.
 * Subset of {@link ALLOWED_NODE_ATTR_KEYS} for nodes that declare attrs.
 */
export const VALIDATOR_HANDLED_ATTRS: Readonly<
  Record<string, readonly string[]>
> = {
  heading: ["level"],
  orderedList: ["start", "type"],
};

export type TiptapJson = {
  type: string;
  content?: TiptapJson[];
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
};

export type AssertTiptapOptions = {
  /**
   * Override {@link DOCUMENT_LINKS_ENABLED}. Used in tests to exercise the
   * safe-href path without enabling links in production.
   */
  linksEnabled?: boolean;
};

/** Empty Tiptap doc: a single paragraph. */
export const EMPTY_DOCUMENT_CONTENT: TiptapJson = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function serialisedContentSize(content: unknown): number {
  return new TextEncoder().encode(JSON.stringify(content)).length;
}

/**
 * TipTap/ProseMirror `getJSON()` builds `attrs` with a null prototype.
 * React Server Actions reject (or mangle) null-prototype objects, which made
 * heading saves fail Zod with "Invalid document input". Clone to plain JSON
 * before crossing the Server Action boundary.
 */
export function plainTiptapJson(value: unknown): TiptapJson {
  return JSON.parse(JSON.stringify(value)) as TiptapJson;
}

const allowedNodeSet = new Set<string>(ALLOWED_NODE_TYPES);
const allowedMarkSet = new Set<string>(ALLOWED_MARK_TYPES);
const allowedHeadingSet = new Set<number>(ALLOWED_HEADING_LEVELS);
const allowedOrderedListTypeSet = new Set<string>(ALLOWED_ORDERED_LIST_TYPES);
const allowedLinkSchemeSet = new Set<string>(ALLOWED_LINK_HREF_SCHEMES);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Iteratively ensure TipTap node nesting stays within
 * {@link DOCUMENT_CONTENT_MAX_DEPTH}. Root node is depth 0.
 * Only `content` children increment depth; marks/attrs are ignored here.
 */
export function assertContentJsonDepth(
  value: unknown,
  maxDepth = DOCUMENT_CONTENT_MAX_DEPTH,
  path = "content",
): void {
  if (!isPlainObject(value)) {
    return;
  }

  const stack: Array<{ value: Record<string, unknown>; depth: number; path: string }> =
    [{ value, depth: 0, path }];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.depth > maxDepth) {
      throw new Error(
        `${current.path}: exceeds maximum nesting depth of ${maxDepth}`,
      );
    }

    const content = current.value.content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (let index = content.length - 1; index >= 0; index -= 1) {
      const child = content[index];
      if (isPlainObject(child)) {
        stack.push({
          value: child,
          depth: current.depth + 1,
          path: `${current.path}.content[${index}]`,
        });
      }
    }
  }
}

/**
 * Validate a link `href` when links are enabled. Only http, https, and mailto
 * schemes are accepted; `javascript:` and others are rejected.
 */
export function assertAllowedLinkHref(
  href: unknown,
  path = "href",
): string {
  if (typeof href !== "string" || href.trim() === "") {
    throw new Error(`${path}: link href is required`);
  }

  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    throw new Error(`${path}: link href is not a valid URL`);
  }

  const scheme = parsed.protocol;
  if (!allowedLinkSchemeSet.has(scheme)) {
    throw new Error(`${path}: link href scheme '${scheme}' is not allowed`);
  }

  return href;
}

function assertNoUnexpectedAttrKeys(
  attrs: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
  label: string,
): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(attrs)) {
    if (!allowed.has(key)) {
      throw new Error(`${path}: unexpected attrs on '${label}'`);
    }
  }
}

function assertAllowedMark(
  mark: unknown,
  path: string,
  linksEnabled: boolean,
): { type: string; attrs?: Record<string, unknown> } {
  if (!isPlainObject(mark) || typeof mark.type !== "string") {
    throw new Error(`${path}: invalid mark`);
  }

  if (mark.type === "link") {
    if (!linksEnabled) {
      throw new Error(`${path}: link marks are disabled`);
    }
    if (mark.attrs === undefined) {
      throw new Error(`${path}: link mark requires attrs.href`);
    }
    if (!isPlainObject(mark.attrs)) {
      throw new Error(`${path}: link attrs must be an object`);
    }
    assertNoUnexpectedAttrKeys(
      mark.attrs,
      ALLOWED_MARK_ATTR_KEYS.link,
      path,
      "link",
    );
    const href = assertAllowedLinkHref(mark.attrs.href, `${path}.attrs.href`);
    return { type: "link", attrs: { href } };
  }

  if (!allowedMarkSet.has(mark.type)) {
    throw new Error(`${path}: mark '${mark.type}' is not allowed`);
  }

  const allowedKeys = ALLOWED_MARK_ATTR_KEYS[mark.type]!;
  if (mark.attrs !== undefined) {
    if (!isPlainObject(mark.attrs)) {
      throw new Error(`${path}: mark attrs must be an object`);
    }
    assertNoUnexpectedAttrKeys(mark.attrs, allowedKeys, path, mark.type);
  }

  return { type: mark.type };
}

/**
 * Recursively validate + sanitise Tiptap JSON against the allow-list.
 * Unknown nodes/marks/attrs are rejected (not silently dropped), so a load of
 * legacy/off-spec JSON cannot become an empty doc that overwrites on the next
 * save — callers must handle the error or refuse to save.
 *
 * Depth is checked once at this public entry (not via `path === "content"`),
 * then validation walks the tree. Callers may pass any root path label.
 */
export function assertAllowedTiptapJson(
  value: unknown,
  path = "content",
  options?: AssertTiptapOptions,
): TiptapJson {
  assertContentJsonDepth(value, DOCUMENT_CONTENT_MAX_DEPTH, path);
  return validateAllowedTiptapJson(value, path, options);
}

function validateAllowedTiptapJson(
  value: unknown,
  path: string,
  options?: AssertTiptapOptions,
): TiptapJson {
  if (!isPlainObject(value)) {
    throw new Error(`${path}: expected an object`);
  }

  const type = value.type;
  if (typeof type !== "string" || !allowedNodeSet.has(type)) {
    throw new Error(`${path}: node type '${String(type)}' is not allowed`);
  }

  const linksEnabled = options?.linksEnabled ?? DOCUMENT_LINKS_ENABLED;
  const result: TiptapJson = { type };
  const allowedAttrKeys =
    ALLOWED_NODE_ATTR_KEYS[type as (typeof ALLOWED_NODE_TYPES)[number]];

  if (value.attrs !== undefined) {
    if (!isPlainObject(value.attrs)) {
      throw new Error(`${path}: ${type} attrs must be an object`);
    }
    assertNoUnexpectedAttrKeys(value.attrs, allowedAttrKeys, path, type);
  }

  if (type === "heading") {
    const level = isPlainObject(value.attrs) ? value.attrs.level : undefined;
    if (typeof level !== "number" || !allowedHeadingSet.has(level)) {
      throw new Error(`${path}: heading level must be 2 or 3`);
    }
    result.attrs = { level };
  } else if (type === "orderedList") {
    // TipTap OrderedList always serialises { start, type } (type default null).
    if (isPlainObject(value.attrs)) {
      const attrs = value.attrs;
      const start = attrs.start;
      if (
        start !== undefined &&
        (typeof start !== "number" ||
          !Number.isInteger(start) ||
          start < 1)
      ) {
        throw new Error(`${path}: orderedList start must be an integer ≥ 1`);
      }
      const listType = attrs.type;
      if (
        listType !== undefined &&
        listType !== null &&
        (typeof listType !== "string" ||
          !allowedOrderedListTypeSet.has(listType))
      ) {
        throw new Error(`${path}: orderedList type is not allowed`);
      }
      const nextAttrs: Record<string, unknown> = {};
      if (typeof start === "number") {
        nextAttrs.start = start;
      }
      if (typeof listType === "string") {
        nextAttrs.type = listType;
      }
      if (Object.keys(nextAttrs).length > 0) {
        result.attrs = nextAttrs;
      }
    }
  }

  if (type === "text") {
    if (typeof value.text !== "string") {
      throw new Error(`${path}: text node requires a string text field`);
    }
    result.text = value.text;
    if (value.marks !== undefined) {
      if (!Array.isArray(value.marks)) {
        throw new Error(`${path}: marks must be an array`);
      }
      result.marks = value.marks.map((mark, index) =>
        assertAllowedMark(mark, `${path}.marks[${index}]`, linksEnabled),
      );
    }
    if (value.content !== undefined) {
      throw new Error(`${path}: text nodes cannot have content`);
    }
    return result;
  }

  if (type === "hardBreak") {
    if (value.content !== undefined || value.text !== undefined) {
      throw new Error(`${path}: hardBreak is a leaf node`);
    }
    return result;
  }

  if (value.content !== undefined) {
    if (!Array.isArray(value.content)) {
      throw new Error(`${path}: content must be an array`);
    }
    result.content = value.content.map((child, index) =>
      validateAllowedTiptapJson(child, `${path}.content[${index}]`, options),
    );
  }

  if (type === "doc" && !result.content) {
    result.content = [{ type: "paragraph" }];
  }

  return result;
}

export const documentIdSchema = z
  .string()
  .regex(DOCUMENT_ID_PATTERN, "Invalid document id");

export const documentTitleSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(DOCUMENT_TITLE_MIN, "Title is required")
      .max(
        DOCUMENT_TITLE_MAX,
        `Title must be at most ${DOCUMENT_TITLE_MAX} characters`,
      ),
  );

export function contentValidationMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Content contains disallowed nodes or marks";
}

export const tiptapJsonSchema: z.ZodType<TiptapJson> = z.custom<TiptapJson>(
  (value) => {
    try {
      assertAllowedTiptapJson(value);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Content contains disallowed nodes or marks" },
);

export const documentContentSchema = z
  .unknown()
  .transform((value, ctx) => {
    try {
      return assertAllowedTiptapJson(value);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: contentValidationMessage(error),
      });
      return z.NEVER;
    }
  })
  .superRefine((value, ctx) => {
    const size = serialisedContentSize(value);
    if (size > DOCUMENT_CONTENT_MAX_BYTES) {
      ctx.addIssue({
        code: "custom",
        message: `Content must be at most ${DOCUMENT_CONTENT_MAX_BYTES} bytes when serialised`,
      });
    }
  });

export const createDocumentInputSchema = z.object({
  title: documentTitleSchema.optional().default(DEFAULT_DOCUMENT_TITLE),
  content: documentContentSchema.optional().default(EMPTY_DOCUMENT_CONTENT),
});

/** Parse documentId alone first (owner check runs before title/content Zod). */
export const documentIdOnlySchema = z.object({
  documentId: documentIdSchema,
});

export const updateDocumentContentBodySchema = z.object({
  content: documentContentSchema,
});

export const renameDocumentBodySchema = z.object({
  title: documentTitleSchema,
});

export const updateDocumentContentInputSchema = z.object({
  documentId: documentIdSchema,
  content: documentContentSchema,
});

export const renameDocumentInputSchema = z.object({
  documentId: documentIdSchema,
  title: documentTitleSchema,
});

export const deleteDocumentInputSchema = z.object({
  documentId: documentIdSchema,
});

export type CreateDocumentInput = z.infer<typeof createDocumentInputSchema>;
export type UpdateDocumentContentInput = z.infer<
  typeof updateDocumentContentInputSchema
>;
export type RenameDocumentInput = z.infer<typeof renameDocumentInputSchema>;
export type DeleteDocumentInput = z.infer<typeof deleteDocumentInputSchema>;

/** Shared StarterKit options for the live editor and paste stripping. */
export const prosefieldStarterKitOptions = {
  heading: { levels: [2, 3] as [2, 3] },
  // hardBreak left enabled (omit `hardBreak: false`) for Shift+Enter soft breaks.
  code: false,
  codeBlock: false,
  strike: false,
  horizontalRule: false,
  link: false,
  underline: false,
} as const;
