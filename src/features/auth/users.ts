import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  decryptSensitiveString,
  encryptSensitiveString,
} from "@/lib/crypto/envelope";

export type UserDocument = {
  stripeCustomerId: string | null;
  /** Present only when a legacy/migrated encrypted email envelope exists. */
  emailEnc?: {
    keyVersion: number;
    wrappedDataKey: string;
    cipher: {
      ciphertext: string;
      iv: string;
      tag: string;
    };
  };
  createdAt?: unknown;
  updatedAt?: unknown;
};

/**
 * Idempotent upsert of `users/{uid}` on first session.
 * Does not overwrite stripeCustomerId if already set.
 * Email stays in Firebase Auth — not duplicated as plaintext in Firestore.
 * If a caller has a reason to retain email, it is envelope-encrypted.
 */
export async function upsertUserDocument(input: {
  uid: string;
  /** Unused for Firestore writes; kept for call-site compatibility. */
  email?: string;
  /** When true, store email under an envelope (rare — prefer Auth-only). */
  retainEncryptedEmail?: boolean;
}): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection("users").doc(input.uid);

  let emailEnc: UserDocument["emailEnc"] | undefined;
  if (input.retainEncryptedEmail && input.email) {
    const packed = await encryptSensitiveString({
      uid: input.uid,
      docId: input.uid,
      field: "email",
      plaintext: input.email,
    });
    emailEnc = {
      keyVersion: packed.keyVersion,
      wrappedDataKey: packed.wrappedDataKey,
      cipher: packed.cipher,
    };
  }

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, {
        stripeCustomerId: null,
        ...(emailEnc ? { emailEnc } : {}),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    const patch: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      // Strip any accidental plaintext email/password from prior schemas.
      email: FieldValue.delete(),
      password: FieldValue.delete(),
    };
    if (emailEnc) {
      patch.emailEnc = emailEnc;
    }
    tx.set(ref, patch, { merge: true });
  });
}

export async function getUserDocument(
  uid: string,
): Promise<UserDocument | null> {
  const snap = await getAdminFirestore().collection("users").doc(uid).get();
  if (!snap.exists) {
    return null;
  }
  const data = snap.data() ?? {};
  const stripeCustomerId =
    typeof data.stripeCustomerId === "string" ? data.stripeCustomerId : null;
  const result: UserDocument = { stripeCustomerId };
  if (
    data.emailEnc &&
    typeof data.emailEnc === "object" &&
    data.emailEnc !== null
  ) {
    result.emailEnc = data.emailEnc as UserDocument["emailEnc"];
  }
  if (data.createdAt !== undefined) {
    result.createdAt = data.createdAt;
  }
  if (data.updatedAt !== undefined) {
    result.updatedAt = data.updatedAt;
  }
  return result;
}

/** Decrypt a retained email envelope when present (Auth remains source of truth). */
export async function getRetainedUserEmail(uid: string): Promise<string | null> {
  const user = await getUserDocument(uid);
  if (!user?.emailEnc) {
    return null;
  }
  return decryptSensitiveString({
    uid,
    docId: uid,
    field: "email",
    keyVersion: user.emailEnc.keyVersion,
    wrappedDataKey: user.emailEnc.wrappedDataKey,
    cipher: user.emailEnc.cipher,
  });
}
