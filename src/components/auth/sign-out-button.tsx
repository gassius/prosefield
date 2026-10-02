"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { siteCopy } from "@/content/site";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/features/auth/constants";

function readCsrfFromDocument(): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : undefined;
}

type SignOutButtonProps = {
  className?: string;
};

export function SignOutButton({ className }: SignOutButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);
    try {
      const token = readCsrfFromDocument();
      if (!token) {
        console.error("[sign-out] missing CSRF cookie");
        setError(siteCopy.auth.networkError);
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
        console.error("[sign-out] DELETE /api/session failed", {
          status: response.status,
        });
        setError(siteCopy.auth.networkError);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      console.error("[sign-out] request failed", err);
      setError(siteCopy.auth.networkError);
    } finally {
      setPending(false);
    }
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
        <span role="alert" className="text-destructive text-xs">
          {error}
        </span>
      ) : null}
    </span>
  );
}
