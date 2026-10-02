/**
 * Access policy (Architecture §5.4): only `active` grants access.
 * `cancel_at_period_end` keeps access until Stripe ends the subscription
 * (status remains `active` until then).
 */
export const ENTITLED_SUBSCRIPTION_STATUS = "active" as const;

export type StripeSubscriptionStatus =
  | "active"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "past_due"
  | "paused"
  | "trialing"
  | "unpaid"
  | string;

export function isEntitledStatus(status: string | null | undefined): boolean {
  return status === ENTITLED_SUBSCRIPTION_STATUS;
}

/** Statuses that mean payment did not unlock access (Art Direction 12.5 failed). */
export function isFailedBillingStatus(status: string | null | undefined): boolean {
  if (!status) {
    return false;
  }
  return (
    status === "incomplete_expired" ||
    status === "unpaid" ||
    status === "canceled"
  );
}

/**
 * Whether an incoming Stripe Subscription should replace the uid projection.
 * Same subscription id always updates. A different subscription must not
 * downgrade an entitled (`active`) projection (cross-subscription lockout).
 * An `active` incoming subscription always wins (e.g. past_due → resubscribe).
 */
export function shouldReplaceSubscriptionProjection(
  existing:
    | {
        stripeSubscriptionId?: string | null;
        status?: string | null;
      }
    | null
    | undefined,
  incoming: { id: string; status: string },
): boolean {
  if (!existing?.stripeSubscriptionId) {
    return true;
  }
  if (existing.stripeSubscriptionId === incoming.id) {
    return true;
  }
  if (isEntitledStatus(incoming.status)) {
    return true;
  }
  if (isEntitledStatus(existing.status)) {
    return false;
  }
  return true;
}
