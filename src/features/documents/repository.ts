import "server-only";

import {
  FieldValue,
  Timestamp,
  type DocumentData,
} from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  assertAllowedTiptapJson,
  DEFAULT_DOCUMENT_TITLE,
  EMPTY_DOCUMENT_CONTENT,
  type TiptapJson,
} from "@/features/documents/schemas";

export type DocumentRecord = {
  id: string;
  ownerId: string;
  title: string;
  content: TiptapJson;
  /** False when stored JSON fails the allow-list — editor must not save until repaired. */
  contentAllowed: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type DocumentListItem = {
  id: string;
  title: string;
  updatedAt: Date;
};

function parseTimestamp(value: unknown): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  return new Date(0);
}

/**
 * Parse stored content. Off-spec JSON is NOT coerced to an empty doc for
 * editing — contentAllowed=false blocks save so Tiptap cannot overwrite
 * the stored payload with an emptied schema load (Architecture data-loss fix).
 */
function parseContent(raw: unknown): {
  content: TiptapJson;
  contentAllowed: boolean;
} {
  let parsed: unknown;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { content: { ...EMPTY_DOCUMENT_CONTENT }, contentAllowed: false };
    }
  } else if (raw && typeof raw === "object") {
    parsed = raw;
  } else {
    return { content: { ...EMPTY_DOCUMENT_CONTENT }, contentAllowed: false };
  }

  try {
    return {
      content: assertAllowedTiptapJson(parsed),
      contentAllowed: true,
    };
  } catch {
    return { content: { ...EMPTY_DOCUMENT_CONTENT }, contentAllowed: false };
  }
}

/** Persist as serialised JSON string so firestore.rules can bound size(). */
function serialiseContent(content: TiptapJson): string {
  return JSON.stringify(content);
}

function toRecord(id: string, data: DocumentData): DocumentRecord {
  const { content, contentAllowed } = parseContent(data.content);
  return {
    id,
    ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
    title: typeof data.title === "string" ? data.title : DEFAULT_DOCUMENT_TITLE,
    content,
    contentAllowed,
    createdAt: parseTimestamp(data.createdAt),
    updatedAt: parseTimestamp(data.updatedAt),
  };
}

export async function listDocumentsForOwner(
  ownerId: string,
): Promise<DocumentListItem[]> {
  const snap = await getAdminFirestore()
    .collection("documents")
    .where("ownerId", "==", ownerId)
    .orderBy("updatedAt", "desc")
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title:
        typeof data.title === "string" ? data.title : DEFAULT_DOCUMENT_TITLE,
      updatedAt: parseTimestamp(data.updatedAt),
    };
  });
}

export async function getDocumentById(
  documentId: string,
): Promise<DocumentRecord | null> {
  const snap = await getAdminFirestore()
    .collection("documents")
    .doc(documentId)
    .get();
  if (!snap.exists) {
    return null;
  }
  return toRecord(snap.id, snap.data() ?? {});
}

export async function createDocument(input: {
  ownerId: string;
  title?: string;
  content?: TiptapJson;
}): Promise<DocumentRecord> {
  const ref = getAdminFirestore().collection("documents").doc();
  const title = input.title?.trim() || DEFAULT_DOCUMENT_TITLE;
  const content = input.content ?? { ...EMPTY_DOCUMENT_CONTENT };
  const payload = {
    ownerId: input.ownerId,
    title,
    content: serialiseContent(content),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(payload);
  const created = await ref.get();
  return toRecord(ref.id, created.data() ?? payload);
}

export async function updateDocumentContent(input: {
  documentId: string;
  content: TiptapJson;
}): Promise<DocumentRecord | null> {
  const ref = getAdminFirestore().collection("documents").doc(input.documentId);
  const snap = await ref.get();
  if (!snap.exists) {
    return null;
  }
  await ref.update({
    content: serialiseContent(input.content),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const updated = await ref.get();
  return toRecord(ref.id, updated.data() ?? {});
}

export async function renameDocument(input: {
  documentId: string;
  title: string;
}): Promise<DocumentRecord | null> {
  const ref = getAdminFirestore().collection("documents").doc(input.documentId);
  const snap = await ref.get();
  if (!snap.exists) {
    return null;
  }
  await ref.update({
    title: input.title,
    updatedAt: FieldValue.serverTimestamp(),
  });
  const updated = await ref.get();
  return toRecord(ref.id, updated.data() ?? {});
}

export async function deleteDocument(documentId: string): Promise<boolean> {
  const ref = getAdminFirestore().collection("documents").doc(documentId);
  const snap = await ref.get();
  if (!snap.exists) {
    return false;
  }
  await ref.delete();
  return true;
}
