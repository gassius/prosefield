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
    let ignoredWords = "[]";
    const ignoredWordsCipher =
      data.ignoredWordsCipher &&
      typeof data.ignoredWordsCipher === "object" &&
      typeof (data.ignoredWordsCipher as { ciphertext?: unknown }).ciphertext ===
        "string"
        ? (data.ignoredWordsCipher as {
            ciphertext: string;
            iv: string;
            tag: string;
          })
        : undefined;
    try {
      const decrypted = await decryptDocumentFields({
        uid: ownerId,
        docId: input.documentId,
        fields: {
          keyVersion: data.keyVersion,
          wrappedDataKey: data.wrappedDataKey,
          titleCipher: data.titleCipher,
          contentCipher: data.contentCipher,
          ignoredWordsCipher,
        },
      });
      title = decrypted.title || title;
      ignoredWords = decrypted.ignoredWords || "[]";
    } catch {
      // Keep defaults if existing ciphertext is already broken.
    }
    // Re-wrap under a fresh DEK — must rewrite ignoredWordsCipher too so it
    // stays bound to the same key as title/content (ClickUp 869fd9py1).
    const encrypted = await encryptDocumentFields({
      uid: ownerId,
      docId: input.documentId,
      title,
      content: input.contentJson,
      ignoredWords,
    });
    await ref.update({
      keyVersion: encrypted.keyVersion,
      wrappedDataKey: encrypted.wrappedDataKey,
      titleCipher: encrypted.titleCipher,
      contentCipher: encrypted.contentCipher,
      ignoredWordsCipher: encrypted.ignoredWordsCipher,
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
