"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUnsavedLeaveGuard } from "@/components/documents/unsaved-leave-guard";
import { siteCopy } from "@/content/site";
import { clearClientSessionState } from "@/features/auth/clear-client-session-state";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/features/auth/constants";

export type SignOutFailureLog = {
  event: "sign_out_failed";
  reason: "http" | "network" | "csrf";
  status?: number;
};

function readCsrfFromDocument(): string | undefined {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`));
  return match
    ? decodeURIComponent(match.split("=").slice(1).join("="))
    : undefined;
}

export function logSignOutFailure(detail: SignOutFailureLog): void {
  console.error("[sign-out]", detail);
}

/**
 * Shared sign-out for AccountMenu (desktop + mobile Sheet) and SignOutButton.
 * After a successful DELETE, always clears client session state (trial drafts).
 * When an {@link UnsavedLeaveGuardProvider} is mounted and dirty, defers the
 * network call through `requestLeave` so leave-anyway / cancel still apply.
 */
export function useSignOut() {
  const router = useRouter();
  const leaveGuard = useUnsavedLeaveGuard();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function performSignOut(): Promise<boolean> {
    setPending(true);
    setError(null);

    const token = readCsrfFromDocument();
    if (!token) {
      logSignOutFailure({ event: "sign_out_failed", reason: "csrf" });
      setError(siteCopy.auth.signOutError);
      setPending(false);
      return false;
    }

    let response: Response;
    try {
      response = await fetch("/api/session", {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          [CSRF_HEADER_NAME]: token,
        },
      });
    } catch {
      logSignOutFailure({ event: "sign_out_failed", reason: "network" });
      setError(siteCopy.auth.signOutError);
      setPending(false);
      return false;
    }

    if (!response.ok) {
      logSignOutFailure({
        event: "sign_out_failed",
        reason: "http",
        status: response.status,
      });
      setError(siteCopy.auth.signOutError);
      setPending(false);
      return false;
    }

    clearClientSessionState();
    router.replace("/");
    router.refresh();
    setPending(false);
    return true;
  }

  async function signOut(): Promise<boolean> {
    if (leaveGuard?.isDirty) {
      leaveGuard.requestLeave(() => {
        void performSignOut();
      });
      return false;
    }
    return performSignOut();
  }

  return { signOut, pending, error };
}
