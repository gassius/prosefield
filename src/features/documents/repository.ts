import "server-only";

import {
  FieldValue,
  Timestamp,
  type DocumentData,
} from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  decryptDocumentFields,
  encryptDocumentFields,
  isEncryptedDocumentData,
  type EncryptedDocumentFields,
} from "@/lib/crypto/envelope";
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

/** Persist as serialised JSON string so size bounds stay meaningful pre-encrypt. */
function serialiseContent(content: TiptapJson): string {
  return JSON.stringify(content);
}

function encryptionWriteFields(
  fields: EncryptedDocumentFields,
): Record<string, unknown> {
  return {
    keyVersion: fields.keyVersion,
    wrappedDataKey: fields.wrappedDataKey,
    titleCipher: fields.titleCipher,
    contentCipher: fields.contentCipher,
    // Clear legacy plaintext fields on every encrypted write.
    title: FieldValue.delete(),
    content: FieldValue.delete(),
  };
}

async function buildEncryptedPayload(input: {
  ownerId: string;
  docId: string;
  title: string;
  content: TiptapJson;
}): Promise<EncryptedDocumentFields> {
  return encryptDocumentFields({
    uid: input.ownerId,
    docId: input.docId,
    title: input.title,
    content: serialiseContent(input.content),
  });
}

async function toRecord(
  id: string,
  data: DocumentData,
): Promise<DocumentRecord> {
  const ownerId = typeof data.ownerId === "string" ? data.ownerId : "";
  const createdAt = parseTimestamp(data.createdAt);
  const updatedAt = parseTimestamp(data.updatedAt);

  if (isEncryptedDocumentData(data)) {
    try {
      const decrypted = await decryptDocumentFields({
        uid: ownerId,
        docId: id,
        fields: {
          keyVersion: data.keyVersion,
          wrappedDataKey: data.wrappedDataKey,
          titleCipher: data.titleCipher,
          contentCipher: data.contentCipher,
        },
      });
      const { content, contentAllowed } = parseContent(decrypted.content);
      return {
        id,
        ownerId,
        title: decrypted.title || DEFAULT_DOCUMENT_TITLE,
        content,
        contentAllowed,
        createdAt,
        updatedAt,
      };
    } catch {
      // Tampered / wrong-key ciphertext — surface as unreadable (blocks save).
      return {
        id,
        ownerId,
        title: DEFAULT_DOCUMENT_TITLE,
        content: { ...EMPTY_DOCUMENT_CONTENT },
        contentAllowed: false,
        createdAt,
        updatedAt,
      };
    }
  }

  // Legacy plaintext — return decrypted view and lazily migrate (idempotent).
  const title =
    typeof data.title === "string" ? data.title : DEFAULT_DOCUMENT_TITLE;
  const { content, contentAllowed } = parseContent(data.content);
  const record: DocumentRecord = {
    id,
    ownerId,
    title,
    content,
    contentAllowed,
    createdAt,
    updatedAt,
  };
  if (ownerId) {
    try {
      await migrateLegacyDocument(record);
    } catch {
      // Migration is best-effort; next write/read retries.
    }
  }
  return record;
}

/**
 * Idempotent plaintext → envelope migration. Safe to call repeatedly;
 * no-ops when the stored doc is already encrypted.
 */
export async function migrateLegacyDocument(
  record: DocumentRecord,
): Promise<boolean> {
  const db = getAdminFirestore();
  const ref = db.collection("documents").doc(record.id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      return false;
    }
    const data = snap.data() ?? {};
    if (isEncryptedDocumentData(data)) {
      return false;
    }
    if (data.ownerId !== record.ownerId) {
      return false;
    }
    const title =
      typeof data.title === "string" ? data.title : DEFAULT_DOCUMENT_TITLE;
    const { content } = parseContent(data.content);
    const encrypted = await buildEncryptedPayload({
      ownerId: record.ownerId,
      docId: record.id,
      title,
      content,
    });
    tx.update(ref, {
      ...encryptionWriteFields(encrypted),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}

export async function listDocumentsForOwner(
  ownerId: string,
): Promise<DocumentListItem[]> {
  const snap = await getAdminFirestore()
    .collection("documents")
    .where("ownerId", "==", ownerId)
    .orderBy("updatedAt", "desc")
    .get();

  const items: DocumentListItem[] = [];
  for (const doc of snap.docs) {
    const record = await toRecord(doc.id, doc.data());
    items.push({
      id: record.id,
      title: record.title,
      updatedAt: record.updatedAt,
    });
  }
  return items;
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
  const encrypted = await buildEncryptedPayload({
    ownerId: input.ownerId,
    docId: ref.id,
    title,
    content,
  });
  const payload = {
    ownerId: input.ownerId,
    keyVersion: encrypted.keyVersion,
    wrappedDataKey: encrypted.wrappedDataKey,
    titleCipher: encrypted.titleCipher,
    contentCipher: encrypted.contentCipher,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(payload);
  const created = await ref.get();
  return toRecord(ref.id, created.data() ?? payload);
}

export async function updateDocumentContent(input: {
  documentId: string;
  ownerId: string;
  content: TiptapJson;
}): Promise<DocumentRecord | null> {
  const db = getAdminFirestore();
  const ref = db.collection("documents").doc(input.documentId);
  const wrote = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      return false;
    }
    const existing = snap.data() ?? {};
    // Ownership must be checked inside the transaction (TOCTOU-safe).
    if (existing.ownerId !== input.ownerId) {
      return false;
    }
    let title = DEFAULT_DOCUMENT_TITLE;
    if (isEncryptedDocumentData(existing)) {
      const decrypted = await decryptDocumentFields({
        uid: input.ownerId,
        docId: input.documentId,
        fields: {
          keyVersion: existing.keyVersion,
          wrappedDataKey: existing.wrappedDataKey,
          titleCipher: existing.titleCipher,
          contentCipher: existing.contentCipher,
        },
      });
      title = decrypted.title || DEFAULT_DOCUMENT_TITLE;
    } else if (typeof existing.title === "string") {
      title = existing.title;
    }
    const encrypted = await buildEncryptedPayload({
      ownerId: input.ownerId,
      docId: input.documentId,
      title,
      content: input.content,
    });
    tx.update(ref, {
      ...encryptionWriteFields(encrypted),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
  if (!wrote) {
    return null;
  }
  // Return the stored server timestamp, not a local Date() stand-in.
  const after = await ref.get();
  if (!after.exists) {
    return null;
  }
  return toRecord(after.id, after.data() ?? {});
}

export async function renameDocument(input: {
  documentId: string;
  ownerId: string;
  title: string;
}): Promise<DocumentRecord | null> {
  const db = getAdminFirestore();
  const ref = db.collection("documents").doc(input.documentId);
  const wrote = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      return false;
    }
    const existing = snap.data() ?? {};
    if (existing.ownerId !== input.ownerId) {
      return false;
    }
    let content: TiptapJson = { ...EMPTY_DOCUMENT_CONTENT };
    if (isEncryptedDocumentData(existing)) {
      const decrypted = await decryptDocumentFields({
        uid: input.ownerId,
        docId: input.documentId,
        fields: {
          keyVersion: existing.keyVersion,
          wrappedDataKey: existing.wrappedDataKey,
          titleCipher: existing.titleCipher,
          contentCipher: existing.contentCipher,
        },
      });
      content = parseContent(decrypted.content).content;
    } else {
      content = parseContent(existing.content).content;
    }
    const encrypted = await buildEncryptedPayload({
      ownerId: input.ownerId,
      docId: input.documentId,
      title: input.title,
      content,
    });
    tx.update(ref, {
      ...encryptionWriteFields(encrypted),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
  if (!wrote) {
    return null;
  }
  const after = await ref.get();
  if (!after.exists) {
    return null;
  }
  return toRecord(after.id, after.data() ?? {});
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
