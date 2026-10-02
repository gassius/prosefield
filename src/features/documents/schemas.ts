import { z } from "zod";

/** Title: trimmed, 1–120 characters (Architecture §8). */
export const DOCUMENT_TITLE_MIN = 1;
export const DOCUMENT_TITLE_MAX = 120;

/** Content: serialised Tiptap JSON ≤ 512 KiB (Architecture §8). */
export const DOCUMENT_CONTENT_MAX_BYTES = 512 * 1024;

export const DEFAULT_DOCUMENT_TITLE = "Untitled document";

/** Empty Tiptap doc: a single paragraph. */
export const EMPTY_DOCUMENT_CONTENT: TiptapJson = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export type TiptapJson = {
  type: string;
  content?: TiptapJson[];
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
  [key: string]: unknown;
};

export function serialisedContentSize(content: unknown): number {
  return new TextEncoder().encode(JSON.stringify(content)).length;
}

export const tiptapJsonSchema: z.ZodType<TiptapJson> = z.lazy(() =>
  z
    .object({
      type: z.string().min(1),
      content: z.array(tiptapJsonSchema).optional(),
      attrs: z.record(z.string(), z.unknown()).optional(),
      marks: z
        .array(
          z.object({
            type: z.string().min(1),
            attrs: z.record(z.string(), z.unknown()).optional(),
          }),
        )
        .optional(),
      text: z.string().optional(),
    })
    .passthrough(),
);

export const documentTitleSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(DOCUMENT_TITLE_MIN, "Title is required")
      .max(DOCUMENT_TITLE_MAX, `Title must be at most ${DOCUMENT_TITLE_MAX} characters`),
  );

export const documentContentSchema = tiptapJsonSchema.superRefine((value, ctx) => {
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

export const updateDocumentContentInputSchema = z.object({
  documentId: z.string().min(1).max(128),
  content: documentContentSchema,
});

export const renameDocumentInputSchema = z.object({
  documentId: z.string().min(1).max(128),
  title: documentTitleSchema,
});

export const deleteDocumentInputSchema = z.object({
  documentId: z.string().min(1).max(128),
});

export type CreateDocumentInput = z.infer<typeof createDocumentInputSchema>;
export type UpdateDocumentContentInput = z.infer<
  typeof updateDocumentContentInputSchema
>;
export type RenameDocumentInput = z.infer<typeof renameDocumentInputSchema>;
export type DeleteDocumentInput = z.infer<typeof deleteDocumentInputSchema>;
