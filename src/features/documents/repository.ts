import "server-only";

import {
  FieldValue,
  Timestamp,
  type DocumentData,
} from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  DEFAULT_DOCUMENT_TITLE,
  EMPTY_DOCUMENT_CONTENT,
  type TiptapJson,
} from "@/features/documents/schemas";

export type DocumentRecord = {
  id: string;
  ownerId: string;
  title: string;
  content: TiptapJson;
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

function parseContent(raw: unknown): TiptapJson {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as TiptapJson;
    } catch {
      return { ...EMPTY_DOCUMENT_CONTENT };
    }
  }
  // Legacy / Admin map writes — accept object-shaped content too.
  if (raw && typeof raw === "object") {
    return raw as TiptapJson;
  }
  return { ...EMPTY_DOCUMENT_CONTENT };
}

/** Persist as serialised JSON string so firestore.rules can bound size(). */
function serialiseContent(content: TiptapJson): string {
  return JSON.stringify(content);
}

function toRecord(id: string, data: DocumentData): DocumentRecord {
  return {
    id,
    ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
    title: typeof data.title === "string" ? data.title : DEFAULT_DOCUMENT_TITLE,
    content: parseContent(data.content),
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
