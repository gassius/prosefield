"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/components/auth/use-sign-out";
import { siteCopy } from "@/content/site";

type SignOutButtonProps = {
  className?: string;
};

export function SignOutButton({ className }: SignOutButtonProps) {
  const { signOut, pending, error } = useSignOut();

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={className}
        disabled={pending}
        onClick={() => {
          void signOut();
        }}
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
