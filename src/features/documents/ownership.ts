import "server-only";

import type { DocumentRecord } from "@/features/documents/repository";

export class DocumentAccessError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "invalid",
  ) {
    super(message);
    this.name = "DocumentAccessError";
  }
}

/**
 * Owner check for an existing document. Other users' docs and missing docs
 * both surface as not_found (404, never 403) — Architecture §5.5 / §9.
 */
export function requireOwner(
  doc: DocumentRecord | null,
  uid: string,
): DocumentRecord {
  if (!doc || doc.ownerId !== uid) {
    throw new DocumentAccessError("Document not found", "not_found");
  }
  return doc;
}

/** Page/loader access: same 404 semantics without throwing. */
export function canAccessDocument(
  doc: DocumentRecord | null,
  uid: string,
): doc is DocumentRecord {
  return Boolean(doc && doc.ownerId === uid);
}
