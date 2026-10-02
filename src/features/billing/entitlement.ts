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
