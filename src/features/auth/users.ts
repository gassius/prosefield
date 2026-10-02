import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";

/**
 * Idempotent upsert of `users/{uid}` on first session.
 * Does not overwrite stripeCustomerId if already set.
 */
export async function upsertUserDocument(input: {
  uid: string;
  email: string;
}): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection("users").doc(input.uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, {
        email: input.email,
        stripeCustomerId: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    const data = snap.data() ?? {};
    tx.set(
      ref,
      {
        email: input.email || data.email || "",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}

export async function getUserDocument(uid: string) {
  const snap = await getAdminFirestore().collection("users").doc(uid).get();
  return snap.exists ? snap.data() : null;
}
