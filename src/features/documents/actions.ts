"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  requireActiveSubscription,
  requireSession,
} from "@/features/auth/guards";
import { SessionError } from "@/features/auth/session";
import {
  DocumentAccessError,
  requireOwner,
} from "@/features/documents/ownership";
import {
  createDocument,
  deleteDocument,
  getDocumentById,
  renameDocument,
  updateDocumentContent,
} from "@/features/documents/repository";
import {
  createDocumentInputSchema,
  deleteDocumentInputSchema,
  documentIdOnlySchema,
  renameDocumentBodySchema,
  updateDocumentContentBodySchema,
} from "@/features/documents/schemas";

export type DocumentActionErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "invalid"
  | "error";

export type DocumentActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: DocumentActionErrorCode; message: string };

function mapError(error: unknown): DocumentActionResult<never> {
  if (error instanceof SessionError) {
    return {
      ok: false,
      code: error.code === "forbidden" ? "forbidden" : "unauthorized",
      message: error.message,
    };
  }
  if (error instanceof DocumentAccessError) {
    return {
      ok: false,
      code: error.code === "invalid" ? "invalid" : "not_found",
      message: error.message,
    };
  }
  if (error instanceof ZodError) {
    return {
      ok: false,
      code: "invalid",
      message: "Invalid document input",
    };
  }
  return {
    ok: false,
    code: "error",
    message: "Something went wrong. Please try again.",
  };
}

/**
 * Guard chain (Architecture §5.5): session → active subscription.
 * Caller then requireOwner, then Zod on the mutation body.
 */
async function guardSessionAndSubscription() {
  const session = await requireSession({ checkRevoked: true });
  await requireActiveSubscription(session.uid);
  return session;
}

function revalidateDocumentPaths(documentId?: string) {
  try {
    revalidatePath("/documents");
    if (documentId) {
      revalidatePath(`/documents/${documentId}`);
    }
  } catch {
    // Outside a Next.js request (unit/integration tests) cache revalidation is a no-op.
  }
}

export async function createDocumentAction(
  input: unknown = {},
): Promise<DocumentActionResult<{ id: string }>> {
  try {
    const session = await guardSessionAndSubscription();
    const parsed = createDocumentInputSchema.parse(input ?? {});
    const doc = await createDocument({
      ownerId: session.uid,
      title: parsed.title,
      content: parsed.content,
    });
    revalidateDocumentPaths(doc.id);
    return { ok: true, data: { id: doc.id } };
  } catch (error) {
    return mapError(error);
  }
}

export async function saveDocumentAction(
  input: unknown,
): Promise<DocumentActionResult<{ id: string; updatedAt: string }>> {
  try {
    const session = await guardSessionAndSubscription();
    // session → subscription → owner → Zod (parse id only, then body).
    // Owner is re-checked inside the repository transaction (TOCTOU-safe).
    const { documentId } = documentIdOnlySchema.parse(input);
    const existing = await getDocumentById(documentId);
    requireOwner(existing, session.uid);
    const { content } = updateDocumentContentBodySchema.parse(input);
    const updated = await updateDocumentContent({
      documentId,
      ownerId: session.uid,
      content,
    });
    if (!updated) {
      throw new DocumentAccessError("Document not found", "not_found");
    }
    revalidateDocumentPaths(updated.id);
    return {
      ok: true,
      data: { id: updated.id, updatedAt: updated.updatedAt.toISOString() },
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function renameDocumentAction(
  input: unknown,
): Promise<DocumentActionResult<{ id: string; title: string }>> {
  try {
    const session = await guardSessionAndSubscription();
    const { documentId } = documentIdOnlySchema.parse(input);
    const existing = await getDocumentById(documentId);
    requireOwner(existing, session.uid);
    const { title } = renameDocumentBodySchema.parse(input);
    const updated = await renameDocument({
      documentId,
      ownerId: session.uid,
      title,
    });
    if (!updated) {
      throw new DocumentAccessError("Document not found", "not_found");
    }
    revalidateDocumentPaths(updated.id);
    return { ok: true, data: { id: updated.id, title: updated.title } };
  } catch (error) {
    return mapError(error);
  }
}

export async function deleteDocumentAction(
  input: unknown,
): Promise<DocumentActionResult<{ id: string }>> {
  try {
    const session = await guardSessionAndSubscription();
    const { documentId } = deleteDocumentInputSchema.parse(input);
    const existing = await getDocumentById(documentId);
    requireOwner(existing, session.uid);
    const deleted = await deleteDocument(documentId);
    if (!deleted) {
      throw new DocumentAccessError("Document not found", "not_found");
    }
    revalidateDocumentPaths(documentId);
    return { ok: true, data: { id: documentId } };
  } catch (error) {
    return mapError(error);
  }
}
