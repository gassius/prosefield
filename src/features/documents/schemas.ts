import { z } from "zod";

/** Title: trimmed, 1–120 characters (Architecture §8). */
export const DOCUMENT_TITLE_MIN = 1;
export const DOCUMENT_TITLE_MAX = 120;

/** Content: serialised Tiptap JSON ≤ 512 KiB (Architecture §8). */
export const DOCUMENT_CONTENT_MAX_BYTES = 512 * 1024;

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

export const ALLOWED_HEADING_LEVELS = [2, 3] as const;

export type TiptapJson = {
  type: string;
  content?: TiptapJson[];
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
};

/** Empty Tiptap doc: a single paragraph. */
export const EMPTY_DOCUMENT_CONTENT: TiptapJson = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function serialisedContentSize(content: unknown): number {
  return new TextEncoder().encode(JSON.stringify(content)).length;
}

const allowedNodeSet = new Set<string>(ALLOWED_NODE_TYPES);
const allowedMarkSet = new Set<string>(ALLOWED_MARK_TYPES);
const allowedHeadingSet = new Set<number>(ALLOWED_HEADING_LEVELS);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Recursively validate + sanitise Tiptap JSON against the allow-list.
 * Unknown nodes/marks are rejected (not silently dropped to empty), so a
 * load of legacy/off-spec JSON cannot become an empty doc that overwrites
 * on the next save — callers must handle the error or refuse to save.
 */
export function assertAllowedTiptapJson(
  value: unknown,
  path = "content",
): TiptapJson {
  if (!isPlainObject(value)) {
    throw new Error(`${path}: expected an object`);
  }

  const type = value.type;
  if (typeof type !== "string" || !allowedNodeSet.has(type)) {
    throw new Error(`${path}: node type '${String(type)}' is not allowed`);
  }

  const result: TiptapJson = { type };

  if (type === "heading") {
    const level = isPlainObject(value.attrs) ? value.attrs.level : undefined;
    if (typeof level !== "number" || !allowedHeadingSet.has(level)) {
      throw new Error(`${path}: heading level must be 2 or 3`);
    }
    result.attrs = { level };
  } else if (value.attrs !== undefined) {
    // No other node types may carry attrs on the allow-list.
    if (
      isPlainObject(value.attrs) &&
      Object.keys(value.attrs).length > 0
    ) {
      throw new Error(`${path}: unexpected attrs on '${type}'`);
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
      result.marks = value.marks.map((mark, index) => {
        if (!isPlainObject(mark) || typeof mark.type !== "string") {
          throw new Error(`${path}.marks[${index}]: invalid mark`);
        }
        if (!allowedMarkSet.has(mark.type)) {
          throw new Error(
            `${path}.marks[${index}]: mark '${mark.type}' is not allowed`,
          );
        }
        if (
          mark.attrs !== undefined &&
          isPlainObject(mark.attrs) &&
          Object.keys(mark.attrs).length > 0
        ) {
          throw new Error(`${path}.marks[${index}]: unexpected mark attrs`);
        }
        return { type: mark.type };
      });
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
      assertAllowedTiptapJson(child, `${path}.content[${index}]`),
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
        message:
          error instanceof Error
            ? error.message
            : "Content contains disallowed nodes or marks",
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
