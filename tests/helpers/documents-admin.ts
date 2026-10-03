import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";

/** Test-only: write raw Firestore content without going through the allow-list. */
export async function unsafeSetDocumentContent(input: {
  documentId: string;
  contentJson: string;
}): Promise<void> {
  await getAdminFirestore()
    .collection("documents")
    .doc(input.documentId)
    .update({
      content: input.contentJson,
      updatedAt: FieldValue.serverTimestamp(),
    });
}
