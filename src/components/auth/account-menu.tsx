"use client";

import { AlertCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignOut } from "@/components/auth/use-sign-out";
import { siteCopy } from "@/content/site";
import { cn } from "@/lib/utils";

type AccountMenuProps = {
  label: string;
  className?: string;
};

export function AccountMenu({ label, className }: AccountMenuProps) {
  const { signOut, pending, error } = useSignOut();

  return (
    <span className={cn("inline-flex flex-col items-end gap-1", className)}>
      {/* modal=false: avoid aria-hidden on the header while the trigger stays focusable (axe aria-hidden-focus). */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "max-w-[12rem] truncate",
          )}
          aria-label={siteCopy.header.accountMenu}
        >
          <span className="truncate">{label}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={pending}
            onSelect={() => {
              void signOut();
            }}
          >
            {siteCopy.header.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
