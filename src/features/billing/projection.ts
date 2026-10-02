import "server-only";

import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import type Stripe from "stripe";
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
 */
export async function upsertSubscriptionProjection(input: {
  uid: string;
  subscription: Stripe.Subscription;
  lastEventId: string | null;
}): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection("subscriptions").doc(input.uid);
  const data = projectionFromSubscription(
    input.subscription,
    input.lastEventId,
  );
  await ref.set(data, { merge: true });
}

/**
 * Transactional stripeEvents dedupe + projection upsert (Architecture §5.4).
 * Returns whether this event was newly processed.
 */
export async function processEventWithDedupe(input: {
  eventId: string;
  eventType: string;
  eventCreated: number;
  uid: string;
  subscription: Stripe.Subscription;
}): Promise<{ processed: boolean }> {
  const db = getAdminFirestore();
  const eventRef = db.collection("stripeEvents").doc(input.eventId);
  const subRef = db.collection("subscriptions").doc(input.uid);

  return db.runTransaction(async (tx) => {
    const existing = await tx.get(eventRef);
    if (existing.exists) {
      return { processed: false };
    }

    tx.set(eventRef, {
      type: input.eventType,
      created: input.eventCreated,
      processedAt: FieldValue.serverTimestamp(),
    });

    const projection = projectionFromSubscription(
      input.subscription,
      input.eventId,
    );
    tx.set(subRef, projection, { merge: true });
    return { processed: true };
  });
}

export async function getSubscriptionProjection(uid: string) {
  const snap = await getAdminFirestore().collection("subscriptions").doc(uid).get();
  if (!snap.exists) {
    return null;
  }
  return snap.data() as SubscriptionProjection;
}
