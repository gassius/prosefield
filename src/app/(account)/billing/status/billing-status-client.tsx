"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useEffectEvent, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { siteCopy } from "@/content/site";
import { pollBillingStatus } from "@/features/billing/actions";
import { persistStashedTrialDraft } from "@/features/documents/persist-trial-draft";

const POLL_INTERVAL_MS = 2_000;
const POLL_MAX_MS = 30_000;

type StatusPhase =
  | "pending"
  | "delayed"
  | "failed"
  | "active"
  | "persist_failed";

/**
 * After verified active: create the stashed trial draft (if any).
 * Keeps the stash and surfaces retry UI on create failure — never hangs on
 * the spinner, and never silently drops a paid user's draft.
 */
async function tryPersistActive(
  router: ReturnType<typeof useRouter>,
  uid: string,
): Promise<"navigated" | "persist_failed"> {
  try {
    const persisted = await persistStashedTrialDraft(uid);
    if (persisted.ok) {
      router.replace(`/documents/${persisted.documentId}`);
      return "navigated";
    }
    if (persisted.reason === "none") {
      router.replace("/documents");
      return "navigated";
    }
    return "persist_failed";
  } catch {
    return "persist_failed";
  }
}

export function BillingStatusClient(props: {
  initialView: "pending" | "failed" | "active";
  uid: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<StatusPhase>(
    props.initialView === "active"
      ? "active"
      : props.initialView === "failed"
        ? "failed"
        : "pending",
  );
  const [retrying, setRetrying] = useState(false);

  const runPersist = useCallback(async () => {
    const outcome = await tryPersistActive(router, props.uid);
    if (outcome === "persist_failed") {
      setPhase("persist_failed");
    }
  }, [props.uid, router]);

  const onPollResult = useEffectEvent(
    async (status: "pending" | "active" | "failed") => {
      if (status === "active") {
        setPhase("active");
        await runPersist();
        return;
      }
      if (status === "failed") {
        setPhase("failed");
      }
    },
  );

  useEffect(() => {
    if (props.initialView === "active") {
      void runPersist();
      return;
    }
    if (props.initialView === "failed") {
      return;
    }

    const started = Date.now();
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (cancelled) {
        return;
      }
      try {
        const result = await pollBillingStatus();
        if (cancelled) {
          return;
        }
        await onPollResult(result.status);
        if (result.status === "active" || result.status === "failed") {
          return;
        }
      } catch {
        // Keep pending; next tick retries.
      }

      if (Date.now() - started >= POLL_MAX_MS) {
        setPhase("delayed");
        return;
      }
      timeoutId = setTimeout(() => {
        void tick();
      }, POLL_INTERVAL_MS);
    };

    timeoutId = setTimeout(() => {
      void tick();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [props.initialView, runPersist]);

  const onRetryPersist = async () => {
    setRetrying(true);
    try {
      const outcome = await tryPersistActive(router, props.uid);
      if (outcome === "persist_failed") {
        setPhase("persist_failed");
      }
    } finally {
      setRetrying(false);
    }
  };

  if (phase === "failed") {
    return (
      <div
        className="rounded-xl bg-destructive-soft p-6"
        role="alert"
      >
        <h1 className="font-display text-2xl font-medium tracking-tight text-foreground">
          {siteCopy.billingStatus.failedTitle}
        </h1>
        <p className="text-muted-foreground mt-3 text-base leading-relaxed">
          {siteCopy.billingStatus.failedBody}
        </p>
        <form action="/subscribe" method="get" className="mt-8">
          <Button type="submit">{siteCopy.billingStatus.tryAgain}</Button>
        </form>
      </div>
    );
  }

  if (phase === "persist_failed") {
    return (
      <div
        className="rounded-xl bg-destructive-soft p-6"
        role="alert"
        data-testid="trial-persist-failed"
      >
        <h1 className="font-display text-2xl font-medium tracking-tight text-foreground">
          {siteCopy.documents.trialPersistFailedTitle}
        </h1>
        <p className="text-muted-foreground mt-3 text-base leading-relaxed">
          {siteCopy.documents.trialPersistFailedBody}
        </p>
        <div className="mt-8">
          <Button
            type="button"
            onClick={() => {
              void onRetryPersist();
            }}
            disabled={retrying}
            aria-busy={retrying}
            data-testid="trial-persist-retry"
          >
            {siteCopy.documents.trialPersistRetry}
          </Button>
        </div>
      </div>
    );
  }

  const message =
    phase === "delayed"
      ? siteCopy.billingStatus.delayed
      : siteCopy.billingStatus.pending;

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <div
        className="bg-warning-soft h-3 w-full max-w-xs animate-pulse rounded-md"
        aria-hidden
      />
      <div
        className="bg-muted h-3 w-full max-w-sm animate-pulse rounded-md"
        aria-hidden
      />
      <h1 className="font-display text-2xl font-medium tracking-tight">
        {siteCopy.billingStatus.title}
      </h1>
      <p className="text-muted-foreground text-base leading-relaxed">{message}</p>
    </div>
  );
}
