import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { redactForLog } from "@/lib/crypto/redact";
import { getStripe } from "@/lib/stripe/server";

/**
 * Get or create a Stripe Customer idempotently inside a users/{uid} transaction.
 * Uses Idempotency-Key `customer-<uid>` and metadata.firebaseUid (Architecture §5.4).
 * Email is applied in a follow-up update only on create, or when it differs from
 * the stored Stripe Customer, so Dashboard edits are not overwritten on every checkout.
 * Email is not written to Firestore (Firebase Auth remains the source of truth).
 */
export async function getOrCreateStripeCustomer(input: {
  uid: string;
  email: string;
}): Promise<string> {
  const db = getAdminFirestore();
  const userRef = db.collection("users").doc(input.uid);
  const stripe = getStripe();

  const { customerId, created } = await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const existing = snap.data()?.stripeCustomerId;
    if (typeof existing === "string" && existing.length > 0) {
      return { customerId: existing, created: false };
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
          email: FieldValue.delete(),
          password: FieldValue.delete(),
        },
        { merge: true },
      );
    }

    tx.set(db.collection("stripeCustomers").doc(customer.id), {
      uid: input.uid,
      createdAt: now,
    });

    return { customerId: customer.id, created: true };
  });

  if (!input.email) {
    return customerId;
  }

  if (created) {
    await updateCustomerEmail(stripe, customerId, input.email);
    return customerId;
  }

  try {
    const existing = await stripe.customers.retrieve(customerId);
    if (!existing.deleted && existing.email !== input.email) {
      await updateCustomerEmail(stripe, customerId, input.email);
    }
  } catch (error) {
    logCustomerEmailError(error);
  }

  return customerId;
}

async function updateCustomerEmail(
  stripe: ReturnType<typeof getStripe>,
  customerId: string,
  email: string,
): Promise<void> {
  try {
    await stripe.customers.update(customerId, { email });
  } catch (error) {
    logCustomerEmailError(error);
  }
}

function logCustomerEmailError(error: unknown): void {
  console.error(
    "[billing] customer email update failed",
    redactForLog({
      code:
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : "unknown",
    }),
  );
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
