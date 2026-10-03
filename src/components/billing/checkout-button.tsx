"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { siteCopy } from "@/content/site";

/**
 * Starts Checkout via POST /api/checkout (JSON clients get 409/503/401; browsers redirect).
 */
export function CheckoutButton(props: { label: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          accept: "application/json",
        },
        redirect: "manual",
      });

      if (response.status === 401) {
        router.replace("/login?next=/subscribe");
        return;
      }

      if (response.status === 409) {
        router.replace("/documents");
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
