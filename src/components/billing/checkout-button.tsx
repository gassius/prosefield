"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { siteCopy } from "@/content/site";
import type { CheckoutCancelPath } from "@/features/billing/checkout-cancel-path";

/**
 * Starts Checkout via POST /api/checkout (JSON clients get 409/503/401; browsers redirect).
 */
export function CheckoutButton(props: {
  label: string;
  /** Stripe cancel_url path (allow-listed server-side). */
  cancelPath?: CheckoutCancelPath;
  /** Runs before the checkout request (e.g. stash trial draft). */
  onBeforeCheckout?: () => void | Promise<void>;
  className?: string;
  variant?: "default" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg";
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      if (props.onBeforeCheckout) {
        await props.onBeforeCheckout();
      }
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          cancelPath: props.cancelPath ?? "/subscribe",
        }),
        redirect: "manual",
      });

      if (response.status === 401) {
        router.replace("/login?next=/subscribe");
        return;
      }

      if (response.status === 409) {
        // Stay on /subscribe with a clear next step — do not bounce to
        // /documents (past_due/unpaid users would loop through the upgrade gate).
        setError(siteCopy.subscribe.checkoutConflict);
        return;
      }

      if (response.status === 503) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? siteCopy.subscribe.checkoutError);
        return;
      }

      // JSON success body with Checkout URL.
      if (response.ok) {
        const body = (await response.json()) as { url?: string };
        if (body.url) {
          window.location.assign(body.url);
          return;
        }
      }

      // Form-style 303 to Stripe — follow Location when present.
      if (response.status === 303) {
        const location = response.headers.get("Location");
        if (location) {
          window.location.assign(location);
          return;
        }
      }

      setError(siteCopy.subscribe.checkoutError);
    } catch {
      setError(siteCopy.subscribe.checkoutError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant={props.variant}
        size={props.size}
        className={props.className}
        onClick={() => {
          void onClick();
        }}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? siteCopy.subscribe.checkoutBusy : props.label}
      </Button>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
