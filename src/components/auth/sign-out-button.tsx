"use client";

import { AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useUnsavedLeaveGuard } from "@/components/documents/unsaved-leave-guard";
import { siteCopy } from "@/content/site";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/features/auth/constants";
import { clearTrialDraft } from "@/features/documents/trial-draft-stash";

type SignOutFailureLog = {
  event: "sign_out_failed";
  reason: "http" | "network" | "csrf";
  status?: number;
};

function readCsrfFromDocument(): string | undefined {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : undefined;
}

function logSignOutFailure(detail: SignOutFailureLog): void {
  console.error("[sign-out]", detail);
}

type SignOutButtonProps = {
  className?: string;
  /** When set, clears the uid-scoped trial draft stash after a successful sign-out. */
  trialUid?: string;
};

export function SignOutButton({ className, trialUid }: SignOutButtonProps) {
  const router = useRouter();
  const leaveGuard = useUnsavedLeaveGuard();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function performSignOut() {
    setPending(true);
    setError(null);
    try {
      const token = readCsrfFromDocument();
      if (!token) {
        logSignOutFailure({ event: "sign_out_failed", reason: "csrf" });
        setError(siteCopy.auth.signOutError);
        return;
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
        return;
      }
      if (trialUid) {
        clearTrialDraft(trialUid);
      }
      router.replace("/");
      router.refresh();
    } catch {
      logSignOutFailure({ event: "sign_out_failed", reason: "network" });
      setError(siteCopy.auth.signOutError);
    } finally {
      setPending(false);
    }
  }

  function onClick() {
    if (leaveGuard?.isDirty) {
      leaveGuard.requestLeave(() => {
        void performSignOut();
      });
      return;
    }
    void performSignOut();
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={className}
        disabled={pending}
        onClick={onClick}
      >
        {siteCopy.header.signOut}
      </Button>
      {error ? (
        <span
          role="alert"
          className="bg-destructive-soft text-destructive inline-flex max-w-[16rem] items-start gap-1.5 rounded-md px-2 py-1 text-xs"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </span>
      ) : null}
    </span>
  );
}
