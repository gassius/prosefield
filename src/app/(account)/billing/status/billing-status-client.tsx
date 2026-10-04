"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useEffectEvent } from "react";
import { Button } from "@/components/ui/button";
import { siteCopy } from "@/content/site";
import { pollBillingStatus } from "@/features/billing/actions";
import { persistStashedTrialDraft } from "@/features/documents/persist-trial-draft";

const POLL_INTERVAL_MS = 2_000;
const POLL_MAX_MS = 30_000;

type StatusPhase = "pending" | "delayed" | "failed" | "active";

async function navigateAfterActive(
  router: ReturnType<typeof useRouter>,
  uid: string,
) {
  const persisted = await persistStashedTrialDraft(uid);
  if (persisted.ok) {
    router.replace(`/documents/${persisted.documentId}`);
    return;
  }
  router.replace("/documents");
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

  const onPollResult = useEffectEvent(
    async (status: "pending" | "active" | "failed") => {
      if (status === "active") {
        setPhase("active");
        await navigateAfterActive(router, props.uid);
        return;
      }
      if (status === "failed") {
        setPhase("failed");
      }
    },
  );

  useEffect(() => {
    if (props.initialView === "active") {
      void navigateAfterActive(router, props.uid);
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
  }, [props.initialView, props.uid, router]);

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
