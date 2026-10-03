import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getStripe } from "@/lib/stripe/server";

/**
 * Get or create a Stripe Customer idempotently inside a users/{uid} transaction.
 * Uses Idempotency-Key `customer-<uid>` and metadata.firebaseUid (Architecture §5.4).
 * Email is applied in a follow-up update so a changed email within Stripe's
 * 24h idempotency window does not collide with the create key.
 */
export async function getOrCreateStripeCustomer(input: {
  uid: string;
  email: string;
}): Promise<string> {
  const db = getAdminFirestore();
  const userRef = db.collection("users").doc(input.uid);
  const stripe = getStripe();

  const customerId = await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const existing = snap.data()?.stripeCustomerId;
    if (typeof existing === "string" && existing.length > 0) {
      return existing;
    }

    const customer = await stripe.customers.create(
      {
        metadata: { firebaseUid: input.uid },
      },
      { idempotencyKey: `customer-${input.uid}` },
    );

    const now = FieldValue.serverTimestamp();
    if (!snap.exists) {
      tx.set(userRef, {
        email: input.email,
        stripeCustomerId: customer.id,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      tx.set(
        userRef,
        {
          stripeCustomerId: customer.id,
          updatedAt: now,
        },
        { merge: true },
      );
    }

    tx.set(db.collection("stripeCustomers").doc(customer.id), {
      uid: input.uid,
      createdAt: now,
    });

    return customer.id;
  });

  if (input.email) {
    try {
      await stripe.customers.update(customerId, { email: input.email });
    } catch (error) {
      console.error("[billing] customer email update failed", {
        code:
          error && typeof error === "object" && "code" in error
            ? String((error as { code?: string }).code)
            : "unknown",
      });
    }
  }

  return customerId;
}

export async function lookupUidByStripeCustomerId(
  customerId: string,
): Promise<string | null> {
  const snap = await getAdminFirestore()
    .collection("stripeCustomers")
    .doc(customerId)
    .get();
  if (!snap.exists) {
    return null;
  }
  const uid = snap.data()?.uid;
  return typeof uid === "string" ? uid : null;
}
