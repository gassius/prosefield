import "server-only";

import type Stripe from "stripe";
import { isEntitledStatus } from "@/features/billing/entitlement";
import { getStripe } from "@/lib/stripe/server";

function resolveCustomerId(subscription: Stripe.Subscription): string | null {
  const customer = subscription.customer;
  if (!customer) {
    return null;
  }
  return typeof customer === "string" ? customer : customer.id;
}

/**
 * Pick the subscription that should own the uid projection.
 * Prefers an `active` subscription from the customer's full list so ending one
 * of two concurrent subs cannot lock out a still-paying user.
 */
export function preferBestSubscription(
  candidates: Stripe.Subscription[],
  fallback: Stripe.Subscription,
): Stripe.Subscription {
  const active = candidates.find((sub) => isEntitledStatus(sub.status));
  if (active) {
    return active;
  }
  const sameAsFallback = candidates.find((sub) => sub.id === fallback.id);
  return sameAsFallback ?? fallback;
}

/**
 * Resolve the canonical subscription to project for a customer.
 * Lists all statuses and prefers `active`.
 */
export async function resolveProjectionSubscription(
  fallback: Stripe.Subscription,
): Promise<Stripe.Subscription> {
  const customerId = resolveCustomerId(fallback);
  if (!customerId) {
    return fallback;
  }

  const stripe = getStripe();
  const listed = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });

  if (listed.data.length === 0) {
    return fallback;
  }

  return preferBestSubscription(listed.data, fallback);
}
