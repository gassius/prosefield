import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { redirect } from "next/navigation";
import type { AccountState } from "@/features/auth/account-state";
import {
  getOptionalSession,
  SessionError,
} from "@/features/auth/session";
import { isEntitledStatus } from "@/features/billing/entitlement";
import { getAdminFirestore } from "@/lib/firebase/admin";

export type { AccountState, CtaDestination } from "@/features/auth/account-state";
export { ctaDestinationForState } from "@/features/auth/account-state";

async function isSubscriptionActive(uid: string): Promise<boolean> {
  try {
    const snap = await getAdminFirestore()
      .collection("subscriptions")
      .doc(uid)
      .get();
    if (!snap.exists) {
      return false;
    }
    return isEntitledStatus(
      typeof snap.data()?.status === "string" ? snap.data()?.status : null,
    );
  } catch {
    // Backend down / emulator unreachable — treat as not subscribed so marketing still renders.
    return false;
  }
}

export async function getAccountState(): Promise<AccountState> {
  let session: DecodedIdToken | null = null;
  try {
    // Always check revocation so a copied cookie dies immediately after logout.
    session = await getOptionalSession(true);
  } catch {
    return { kind: "logged_out" };
  }

  if (!session) {
    return { kind: "logged_out" };
  }

  const email = typeof session.email === "string" ? session.email : "";
  const active = await isSubscriptionActive(session.uid);
  if (active) {
    return {
      kind: "subscriber",
      uid: session.uid,
      email,
      subscriptionActive: true,
    };
  }

  return {
    kind: "logged_in",
    uid: session.uid,
    email,
    subscriptionActive: false,
  };
}

/**
 * Require a verified session cookie with revocation checked.
 * Pass `checkRevoked: false` only for rare non-security reads (tests).
 */
export async function requireSession(
  options: { checkRevoked?: boolean } = {},
): Promise<DecodedIdToken> {
  const session = await getOptionalSession(options.checkRevoked ?? true);
  if (!session) {
    throw new SessionError("Authentication required", "unauthorized");
  }
  return session;
}

export async function requireSessionOrRedirect(
  loginPath = "/login",
): Promise<DecodedIdToken> {
  try {
    return await requireSession({ checkRevoked: true });
  } catch {
    redirect(loginPath);
  }
}

export async function requireActiveSubscription(uid: string): Promise<void> {
  const active = await isSubscriptionActive(uid);
  if (!active) {
    throw new SessionError("Active subscription required", "forbidden");
  }
}
