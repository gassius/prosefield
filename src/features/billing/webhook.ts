import "server-only";

import type Stripe from "stripe";
import { lookupUidByStripeCustomerId } from "@/features/billing/customers";
import { processEventWithDedupe } from "@/features/billing/projection";
import { resolveProjectionSubscription } from "@/features/billing/subscriptions";
import { getEnv } from "@/lib/env";
import { getStripe } from "@/lib/stripe/server";

const HANDLED_STRIPE_EVENT_TYPES = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
] as const;

type HandledStripeEventType = (typeof HANDLED_STRIPE_EVENT_TYPES)[number];

export function isHandledStripeEventType(
  type: string,
): type is HandledStripeEventType {
  return (HANDLED_STRIPE_EVENT_TYPES as readonly string[]).includes(type);
}

/**
 * Resolve firebase uid: subscription.metadata.firebaseUid →
 * session.client_reference_id → stripeCustomers/{customerId}.
 */
export async function resolveFirebaseUid(input: {
  subscription?: Stripe.Subscription | null;
  session?: Stripe.Checkout.Session | null;
  customerId?: string | null;
}): Promise<string | null> {
  const fromMeta = input.subscription?.metadata?.firebaseUid;
  if (typeof fromMeta === "string" && fromMeta.length > 0) {
    return fromMeta;
  }

  const fromSession = input.session?.client_reference_id;
  if (typeof fromSession === "string" && fromSession.length > 0) {
    return fromSession;
  }

  const customerId =
    input.customerId ??
    (input.subscription
      ? typeof input.subscription.customer === "string"
        ? input.subscription.customer
        : input.subscription.customer?.id
      : null) ??
    (input.session
      ? typeof input.session.customer === "string"
        ? input.session.customer
        : input.session.customer && typeof input.session.customer !== "string"
          ? input.session.customer.id
          : null
      : null);

  if (customerId) {
    return lookupUidByStripeCustomerId(customerId);
  }

  return null;
}

function subscriptionIdFromInvoice(obj: {
  subscription?: string | { id?: string } | null;
  parent?: {
    subscription_details?: {
      subscription?: string | { id?: string } | null;
    } | null;
  } | null;
}): string | null {
  // API 2026-09-30.endive: subscription lives under parent.subscription_details.
  const fromParent = obj.parent?.subscription_details?.subscription;
  if (typeof fromParent === "string") {
    return fromParent;
  }
  if (
    fromParent &&
    typeof fromParent === "object" &&
    typeof fromParent.id === "string"
  ) {
    return fromParent.id;
  }

  // Legacy top-level shape (pre-basil) — keep as last-resort fallback.
  const legacy = obj.subscription;
  if (typeof legacy === "string") {
    return legacy;
  }
  if (legacy && typeof legacy === "object" && typeof legacy.id === "string") {
    return legacy.id;
  }
  return null;
}

function subscriptionIdFromEvent(event: Stripe.Event): string | null {
  const obj = event.data.object as {
    object?: string;
    id?: string;
    subscription?: string | { id?: string } | null;
    parent?: {
      subscription_details?: {
        subscription?: string | { id?: string } | null;
      } | null;
    } | null;
  };

  if (obj.object === "subscription" && typeof obj.id === "string") {
    return obj.id;
  }

  if (obj.object === "checkout.session") {
    const sub = obj.subscription;
    if (typeof sub === "string") {
      return sub;
    }
    if (sub && typeof sub === "object" && typeof sub.id === "string") {
      return sub.id;
    }
  }

  if (obj.object === "invoice") {
    return subscriptionIdFromInvoice(obj);
  }

  return null;
}

export function constructStripeEvent(
  rawBody: string,
  signature: string | null,
): Stripe.Event {
  if (!signature) {
    throw new Error("Missing stripe-signature header");
  }
  const { STRIPE_WEBHOOK_SECRET } = getEnv();
  return getStripe().webhooks.constructEvent(
    rawBody,
    signature,
    STRIPE_WEBHOOK_SECRET,
  );
}

/**
 * Handle a verified Stripe event: retrieve canonical Subscription, prefer an
 * active subscription for the customer, dedupe, project.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<{
  handled: boolean;
  processed: boolean;
  reason?: string;
}> {
  if (!isHandledStripeEventType(event.type)) {
    return { handled: false, processed: false, reason: "ignored_type" };
  }

  const stripe = getStripe();
  let session: Stripe.Checkout.Session | null = null;

  if (event.type === "checkout.session.completed") {
    session = event.data.object as Stripe.Checkout.Session;
  }

  const subscriptionId = subscriptionIdFromEvent(event);
  if (!subscriptionId) {
    return { handled: true, processed: false, reason: "no_subscription_id" };
  }

  const retrieved = await stripe.subscriptions.retrieve(subscriptionId);
  const subscription = await resolveProjectionSubscription(retrieved);

  const uid = await resolveFirebaseUid({
    subscription,
    session,
  });

  if (!uid) {
    const { logError } = await import("@/lib/logger");
    logError("[billing] webhook could not resolve firebaseUid", {
      eventId: event.id,
      type: event.type,
    });
    return { handled: true, processed: false, reason: "uid_unresolved" };
  }

  const { processed } = await processEventWithDedupe({
    eventId: event.id,
    eventType: event.type,
    eventCreated: event.created,
    uid,
    subscription,
  });

  return { handled: true, processed };
}
