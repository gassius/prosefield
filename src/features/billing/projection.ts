import "server-only";

import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { shouldReplaceSubscriptionProjection } from "@/features/billing/entitlement";
import { getAdminFirestore } from "@/lib/firebase/admin";

export type SubscriptionProjection = {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: string;
  currentPeriodEnd: Timestamp | Date | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: Timestamp | Date | FieldValue;
  lastEventId: string | null;
};

function resolveCurrentPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const item = subscription.items?.data?.[0];
  if (item?.current_period_end) {
    return new Date(item.current_period_end * 1000);
  }
  return null;
}

function resolvePriceId(subscription: Stripe.Subscription): string {
  const price = subscription.items?.data?.[0]?.price;
  if (!price) {
    return "";
  }
  return typeof price === "string" ? price : price.id;
}

function resolveCustomerId(subscription: Stripe.Subscription): string {
  const customer = subscription.customer;
  if (!customer) {
    return "";
  }
  return typeof customer === "string" ? customer : customer.id;
}

/**
 * Build the Firestore projection fields from a canonical Stripe Subscription.
 */
export function projectionFromSubscription(
  subscription: Stripe.Subscription,
  lastEventId: string | null,
): Omit<SubscriptionProjection, "updatedAt"> & {
  updatedAt: FieldValue;
} {
  return {
    stripeCustomerId: resolveCustomerId(subscription),
    stripeSubscriptionId: subscription.id,
    stripePriceId: resolvePriceId(subscription),
    status: subscription.status,
    currentPeriodEnd: resolveCurrentPeriodEnd(subscription),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    updatedAt: FieldValue.serverTimestamp(),
    lastEventId,
  };
}

/**
 * Upsert `subscriptions/{uid}` from a retrieved Stripe Subscription snapshot.
 * Shared by the webhook and `/billing/status` session-sync fallback.
 * Skips the write when a different, currently active subscription owns the doc.
 */
export async function upsertSubscriptionProjection(input: {
  uid: string;
  subscription: Stripe.Subscription;
  lastEventId: string | null;
}): Promise<{ written: boolean }> {
  const db = getAdminFirestore();
  const ref = db.collection("subscriptions").doc(input.uid);
  const existing = await ref.get();
  const current = existing.exists ? existing.data() : null;
  if (
    !shouldReplaceSubscriptionProjection(current, {
      id: input.subscription.id,
      status: input.subscription.status,
    })
  ) {
    return { written: false };
  }
  const data = projectionFromSubscription(
    input.subscription,
    input.lastEventId,
  );
  await ref.set(data, { merge: true });
  return { written: true };
}

/**
 * Transactional stripeEvents dedupe + projection upsert (Architecture §5.4).
 * Returns whether this event was newly processed. Always records the event when
 * new; may skip the projection write to protect an active different subscription.
 */
export async function processEventWithDedupe(input: {
  eventId: string;
  eventType: string;
  eventCreated: number;
  uid: string;
  subscription: Stripe.Subscription;
}): Promise<{ processed: boolean; projected: boolean }> {
  const db = getAdminFirestore();
  const eventRef = db.collection("stripeEvents").doc(input.eventId);
  const subRef = db.collection("subscriptions").doc(input.uid);

  return db.runTransaction(async (tx) => {
    const existingEvent = await tx.get(eventRef);
    if (existingEvent.exists) {
      return { processed: false, projected: false };
    }

    const existingSub = await tx.get(subRef);
    const current = existingSub.exists ? existingSub.data() : null;
    const shouldProject = shouldReplaceSubscriptionProjection(current, {
      id: input.subscription.id,
      status: input.subscription.status,
    });

    tx.set(eventRef, {
      type: input.eventType,
      created: input.eventCreated,
      processedAt: FieldValue.serverTimestamp(),
    });

    if (!shouldProject) {
      return { processed: true, projected: false };
    }

    const projection = projectionFromSubscription(
      input.subscription,
      input.eventId,
    );
    tx.set(subRef, projection, { merge: true });
    return { processed: true, projected: true };
  });
}

export async function getSubscriptionProjection(uid: string) {
  const snap = await getAdminFirestore().collection("subscriptions").doc(uid).get();
  if (!snap.exists) {
    return null;
  }
  return snap.data() as SubscriptionProjection;
}
