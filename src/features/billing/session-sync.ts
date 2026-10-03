import "server-only";

import {
  BILLING_NOT_CONFIGURED_MESSAGE,
  isBillingConfigured,
} from "@/features/billing/configured";
import { isEntitledStatus, isFailedBillingStatus } from "@/features/billing/entitlement";
import {
  getSubscriptionProjection,
  upsertSubscriptionProjection,
} from "@/features/billing/projection";
import { resolveProjectionSubscription } from "@/features/billing/subscriptions";
import { getStripe } from "@/lib/stripe/server";

export type BillingStatusView =
  | "pending"
  | "active"
  | "failed"
  | "not_configured";

/** Stripe Checkout Session ids are `cs_test_…` or `cs_live_…` only. */
export const CHECKOUT_SESSION_ID_PATTERN = /^cs_(test|live)_/;

export function isValidCheckoutSessionId(
  sessionId: string | null | undefined,
): boolean {
  return typeof sessionId === "string" && CHECKOUT_SESSION_ID_PATTERN.test(sessionId);
}

/**
 * Server-verified Checkout Session sync (Architecture §5.4 delayed webhook fallback).
 * Requires client_reference_id === uid and session status === 'complete'.
 * Stamps `lastStripeEventCreated` from Checkout Session `created` (Stripe clock),
 * matching webhook `event.created` — never the server wall clock.
 */
export async function syncFromCheckoutSession(input: {
  uid: string;
  sessionId: string;
}): Promise<{ synced: boolean; reason?: string }> {
  if (!isBillingConfigured()) {
    return { synced: false, reason: "not_configured" };
  }

  if (!isValidCheckoutSessionId(input.sessionId)) {
    return { synced: false, reason: "invalid_session_id" };
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(input.sessionId);

  if (session.client_reference_id !== input.uid) {
    return { synced: false, reason: "uid_mismatch" };
  }

  if (session.status === "expired") {
    return { synced: false, reason: "expired" };
  }

  if (session.payment_status === "unpaid" && session.status !== "complete") {
    return { synced: false, reason: "unpaid" };
  }

  if (session.status !== "complete") {
    return { synced: false, reason: "not_complete" };
  }

  const subscriptionRef = session.subscription;
  const subscriptionId =
    typeof subscriptionRef === "string"
      ? subscriptionRef
      : subscriptionRef?.id;

  if (!subscriptionId) {
    return { synced: false, reason: "no_subscription" };
  }

  const retrieved = await stripe.subscriptions.retrieve(subscriptionId);
  const subscription = await resolveProjectionSubscription(retrieved);
  // Stripe clock (session.created), same source family as webhook event.created.
  const eventCreated =
    typeof session.created === "number" ? session.created : null;
  await upsertSubscriptionProjection({
    uid: input.uid,
    subscription,
    lastEventId: `session_sync:${input.sessionId}`,
    eventCreated,
  });

  return { synced: true };
}

export async function resolveBillingStatusView(input: {
  uid: string;
  sessionId?: string | null;
}): Promise<{
  view: BillingStatusView;
  message?: string;
}> {
  if (!isBillingConfigured() && input.sessionId) {
    return {
      view: "not_configured",
      message: BILLING_NOT_CONFIGURED_MESSAGE,
    };
  }

  if (input.sessionId && isBillingConfigured()) {
    try {
      const result = await syncFromCheckoutSession({
        uid: input.uid,
        sessionId: input.sessionId,
      });
      if (result.reason === "expired" || result.reason === "unpaid") {
        return { view: "failed" };
      }
      if (result.reason === "uid_mismatch") {
        return { view: "failed" };
      }
      // Invalid ids are not a payment failure — fall through to projection/pending.
      if (result.reason === "invalid_session_id") {
        // intentionally not "failed"
      }
    } catch (error) {
      console.error("[billing] session sync failed", {
        code:
          error && typeof error === "object" && "code" in error
            ? String((error as { code?: string }).code)
            : "unknown",
      });
    }
  }

  const projection = await getSubscriptionProjection(input.uid);
  if (projection && isEntitledStatus(projection.status)) {
    return { view: "active" };
  }
  if (projection && isFailedBillingStatus(projection.status)) {
    return { view: "failed" };
  }
  return { view: "pending" };
}
