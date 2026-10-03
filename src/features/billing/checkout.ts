import "server-only";

import {
  BILLING_NOT_CONFIGURED_MESSAGE,
  isBillingConfigured,
} from "@/features/billing/configured";
import { getOrCreateStripeCustomer } from "@/features/billing/customers";
import {
  isNonTerminalSubscriptionStatus,
} from "@/features/billing/entitlement";
import { getSubscriptionProjection } from "@/features/billing/projection";
import { getEnv } from "@/lib/env";
import { getStripe } from "@/lib/stripe/server";

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly code: "not_configured" | "already_active" | "stripe_error",
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

/**
 * Create a Stripe Checkout Session for the signed-in user.
 * Throws CheckoutError when billing is not configured or a non-terminal
 * subscription already exists (active, trialing, past_due, unpaid, incomplete).
 */
export async function createCheckoutSession(input: {
  uid: string;
  email: string;
}): Promise<{ url: string; sessionId: string }> {
  if (!isBillingConfigured()) {
    throw new CheckoutError(BILLING_NOT_CONFIGURED_MESSAGE, "not_configured");
  }

  const projection = await getSubscriptionProjection(input.uid);
  if (projection && isNonTerminalSubscriptionStatus(projection.status)) {
    throw new CheckoutError("Subscription already active", "already_active");
  }

  const env = getEnv();
  const customerId = await getOrCreateStripeCustomer({
    uid: input.uid,
    email: input.email,
  });

  const stripe = getStripe();

  // Refuse checkout while Stripe still has any non-terminal subscription.
  const existing = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });
  if (
    existing.data.some((sub) => isNonTerminalSubscriptionStatus(sub.status))
  ) {
    throw new CheckoutError("Subscription already active", "already_active");
  }

  // Reuse an open Checkout Session (double-click / two-tab safety).
  const openSessions = await stripe.checkout.sessions.list({
    customer: customerId,
    status: "open",
    limit: 5,
  });
  const reusable = openSessions.data.find(
    (session) =>
      session.client_reference_id === input.uid &&
      typeof session.url === "string" &&
      session.url.length > 0,
  );
  if (reusable?.url) {
    return { url: reusable.url, sessionId: reusable.id };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: input.uid,
    line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
    subscription_data: {
      metadata: { firebaseUid: input.uid },
    },
    success_url: `${env.APP_URL}/billing/status?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/subscribe`,
    integration_identifier: "prosefield",
  });

  if (!session.url) {
    throw new CheckoutError("Checkout session missing URL", "stripe_error");
  }

  return { url: session.url, sessionId: session.id };
}
