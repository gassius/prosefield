import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  decryptDocumentFields,
  encryptDocumentFields,
  isEncryptedDocumentData,
} from "@/lib/crypto/envelope";

/**
 * Test-only: write document content without going through the Tiptap allow-list.
 * For encrypted docs, re-wraps the provided JSON string as the content plaintext
 * so the app still decrypts it (and can mark contentAllowed=false for off-spec).
 */
export async function unsafeSetDocumentContent(input: {
  documentId: string;
  contentJson: string;
}): Promise<void> {
  const ref = getAdminFirestore().collection("documents").doc(input.documentId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error(`Document ${input.documentId} does not exist`);
  }
  const data = snap.data() ?? {};
  const ownerId = typeof data.ownerId === "string" ? data.ownerId : "";

  if (isEncryptedDocumentData(data) && ownerId) {
    let title = "Untitled document";
    try {
      const decrypted = await decryptDocumentFields({
        uid: ownerId,
        docId: input.documentId,
        fields: {
          keyVersion: data.keyVersion,
          wrappedDataKey: data.wrappedDataKey,
          titleCipher: data.titleCipher,
          contentCipher: data.contentCipher,
        },
      });
      title = decrypted.title || title;
    } catch {
      // Keep default title if existing ciphertext is already broken.
    }
    const encrypted = await encryptDocumentFields({
      uid: ownerId,
      docId: input.documentId,
      title,
      content: input.contentJson,
    });
    await ref.update({
      keyVersion: encrypted.keyVersion,
      wrappedDataKey: encrypted.wrappedDataKey,
      titleCipher: encrypted.titleCipher,
      contentCipher: encrypted.contentCipher,
      title: FieldValue.delete(),
      content: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  await ref.update({
    content: input.contentJson,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
