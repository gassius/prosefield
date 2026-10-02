"use server";

import { requireSession } from "@/features/auth/guards";
import { isEntitledStatus, isFailedBillingStatus } from "@/features/billing/entitlement";
import { getSubscriptionProjection } from "@/features/billing/projection";

export type BillingPollResult = {
  status: "pending" | "active" | "failed";
};

/**
 * Polled by `/billing/status` every ~2 s (Architecture §5.4).
 */
export async function pollBillingStatus(): Promise<BillingPollResult> {
  const session = await requireSession({ checkRevoked: false });
  const projection = await getSubscriptionProjection(session.uid);

  if (projection && isEntitledStatus(projection.status)) {
    return { status: "active" };
  }
  if (projection && isFailedBillingStatus(projection.status)) {
    return { status: "failed" };
  }
  return { status: "pending" };
}
