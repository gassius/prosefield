import "server-only";

import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { shouldReplaceSubscriptionProjection } from "@/features/billing/entitlement";
import { getEnv } from "@/lib/env";
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
  /** Monotonic Stripe event.created used to skip stale concurrent writes. */
  lastStripeEventCreated?: number | null;
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

/** True when the subscription's price matches the configured plan price. */
export function subscriptionMatchesConfiguredPrice(
  subscription: Stripe.Subscription,
  priceId: string = getEnv().STRIPE_PRICE_ID,
): boolean {
  const resolved = resolvePriceId(subscription);
  return resolved.length > 0 && resolved === priceId;
}

/**
 * Build the Firestore projection fields from a canonical Stripe Subscription.
 */
export function projectionFromSubscription(
  subscription: Stripe.Subscription,
  lastEventId: string | null,
  lastStripeEventCreated: number | null = null,
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
    lastStripeEventCreated,
  };
}

/**
 * Whether an incoming event should overwrite the stored projection given
 * retrieve-outside-transaction races (stale concurrent deliveries).
 */
export function shouldAcceptStripeEventCreated(
  existingCreated: number | null | undefined,
  incomingCreated: number | null | undefined,
): boolean {
  if (incomingCreated == null) {
    return true;
  }
  if (existingCreated == null) {
    return true;
  }
  return incomingCreated >= existingCreated;
}

/**
 * Upsert `subscriptions/{uid}` from a retrieved Stripe Subscription snapshot.
 * Shared by the webhook and `/billing/status` session-sync fallback.
 * Skips the write when a different, currently active subscription owns the doc,
 * when the price does not match STRIPE_PRICE_ID, or when the event is older.
 */
export async function upsertSubscriptionProjection(input: {
  uid: string;
  subscription: Stripe.Subscription;
  lastEventId: string | null;
  eventCreated?: number | null;
}): Promise<{ written: boolean; reason?: string }> {
  if (!subscriptionMatchesConfiguredPrice(input.subscription)) {
    return { written: false, reason: "price_mismatch" };
  }

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
    return { written: false, reason: "guarded" };
  }
  if (
    !shouldAcceptStripeEventCreated(
      typeof current?.lastStripeEventCreated === "number"
        ? current.lastStripeEventCreated
        : null,
      input.eventCreated ?? null,
    )
  ) {
    return { written: false, reason: "stale_event" };
  }
  const data = projectionFromSubscription(
    input.subscription,
    input.lastEventId,
    input.eventCreated ?? null,
  );
  await ref.set(data, { merge: true });
  return { written: true };
}

/**
 * Transactional stripeEvents dedupe + projection upsert (Architecture §5.4).
 * Returns whether this event was newly processed. Always records the event when
 * new; may skip the projection write to protect an active different subscription,
 * reject a wrong price, or skip a stale concurrent event.
 */
export async function processEventWithDedupe(input: {
  eventId: string;
  eventType: string;
  eventCreated: number;
  uid: string;
  subscription: Stripe.Subscription;
}): Promise<{ processed: boolean; projected: boolean }> {
  if (!subscriptionMatchesConfiguredPrice(input.subscription)) {
    const db = getAdminFirestore();
    const eventRef = db.collection("stripeEvents").doc(input.eventId);
    return db.runTransaction(async (tx) => {
      const existingEvent = await tx.get(eventRef);
      if (existingEvent.exists) {
        return { processed: false, projected: false };
      }
      tx.set(eventRef, {
        type: input.eventType,
        created: input.eventCreated,
        processedAt: FieldValue.serverTimestamp(),
        skippedReason: "price_mismatch",
      });
      return { processed: true, projected: false };
    });
  }

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
    const freshEnough = shouldAcceptStripeEventCreated(
      typeof current?.lastStripeEventCreated === "number"
        ? current.lastStripeEventCreated
        : null,
      input.eventCreated,
    );

    tx.set(eventRef, {
      type: input.eventType,
      created: input.eventCreated,
      processedAt: FieldValue.serverTimestamp(),
    });

    if (!shouldProject || !freshEnough) {
      return { processed: true, projected: false };
    }

    const projection = projectionFromSubscription(
      input.subscription,
      input.eventId,
      input.eventCreated,
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
