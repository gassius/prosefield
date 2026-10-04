"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { siteCopy } from "@/content/site";
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

export function useSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut(): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      const token = readCsrfFromDocument();
      if (!token) {
        logSignOutFailure({ event: "sign_out_failed", reason: "csrf" });
        setError(siteCopy.auth.signOutError);
        return false;
      }
      const response = await fetch("/api/session", {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          [CSRF_HEADER_NAME]: token,
        },
      });
      if (!response.ok) {
        logSignOutFailure({
          event: "sign_out_failed",
          reason: "http",
          status: response.status,
        });
        setError(siteCopy.auth.signOutError);
        return false;
      }
      router.replace("/");
      router.refresh();
      return true;
    } catch {
      logSignOutFailure({ event: "sign_out_failed", reason: "network" });
      setError(siteCopy.auth.signOutError);
      return false;
    } finally {
      setPending(false);
    }
  }

  return { signOut, pending, error, clearError: () => setError(null) };
}
