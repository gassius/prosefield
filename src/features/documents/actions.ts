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
  type DocumentListItem,
  type DocumentRecord,
} from "@/features/documents/repository";
import {
  createDocumentInputSchema,
  deleteDocumentInputSchema,
  renameDocumentInputSchema,
  updateDocumentContentInputSchema,
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
    const parsed = updateDocumentContentInputSchema.parse(input);
    const existing = await getDocumentById(parsed.documentId);
    requireOwner(existing, session.uid);
    const updated = await updateDocumentContent({
      documentId: parsed.documentId,
      content: parsed.content,
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
    const parsed = renameDocumentInputSchema.parse(input);
    const existing = await getDocumentById(parsed.documentId);
    requireOwner(existing, session.uid);
    const updated = await renameDocument({
      documentId: parsed.documentId,
      title: parsed.title,
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
    const parsed = deleteDocumentInputSchema.parse(input);
    const existing = await getDocumentById(parsed.documentId);
    requireOwner(existing, session.uid);
    const deleted = await deleteDocument(parsed.documentId);
    if (!deleted) {
      throw new DocumentAccessError("Document not found", "not_found");
    }
    revalidateDocumentPaths(parsed.documentId);
    return { ok: true, data: { id: parsed.documentId } };
  } catch (error) {
    return mapError(error);
  }
}

/** Server-only helper for pages: load owned document or null (caller maps to 404). */
export async function loadOwnedDocument(
  documentId: string,
): Promise<DocumentRecord | null> {
  const session = await guardSessionAndSubscription();
  const doc = await getDocumentById(documentId);
  if (!doc || doc.ownerId !== session.uid) {
    return null;
  }
  return doc;
}

export async function loadDocumentList(): Promise<DocumentListItem[]> {
  const session = await guardSessionAndSubscription();
  const { listDocumentsForOwner } = await import(
    "@/features/documents/repository"
  );
  return listDocumentsForOwner(session.uid);
}
