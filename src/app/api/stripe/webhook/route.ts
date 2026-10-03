import { NextResponse } from "next/server";
import { isBillingConfigured } from "@/features/billing/configured";
import {
  constructStripeEvent,
  handleStripeEvent,
} from "@/features/billing/webhook";

export const runtime = "nodejs";

/**
 * POST /api/stripe/webhook — raw body + signature verify (Architecture §5.4).
 * Never parse JSON before constructEvent.
 * Reject placeholder secrets before constructEvent when billing is unconfigured.
 */
export async function POST(request: Request) {
  if (!isBillingConfigured()) {
    return NextResponse.json(
      { error: "Billing is not configured" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event;
  try {
    event = constructStripeEvent(rawBody, signature);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const result = await handleStripeEvent(event);
    return NextResponse.json({
      received: true,
      handled: result.handled,
      processed: result.processed,
      reason: result.reason,
    });
  } catch (error) {
    console.error("[webhook] handler failed", {
      eventId: event.id,
      type: event.type,
      code:
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : "unknown",
    });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
