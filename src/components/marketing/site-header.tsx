"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ProsefieldLogo } from "@/components/brand/prosefield-logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { siteCopy } from "@/content/site";
import type {
  AccountState,
  CtaDestination,
} from "@/features/auth/account-state";
import { cn } from "@/lib/utils";

type SiteHeaderProps = {
  accountState: AccountState;
  ctaHref: CtaDestination;
};

export function SiteHeader({ accountState, ctaHref }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  const loggedIn = accountState.kind !== "logged_out";

  return (
    <header className="border-border bg-background/95 relative border-b">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <ProsefieldLogo />

        <nav
          className="text-muted-foreground hidden items-center gap-6 text-sm md:flex"
          aria-label="Primary"
        >
          <Link href="/#benefits" className="hover:text-foreground transition-colors">
            {siteCopy.header.navBenefits}
          </Link>
          <Link href="/#pricing" className="hover:text-foreground transition-colors">
            {siteCopy.header.navPricing}
          </Link>
          <Link href="/#faq" className="hover:text-foreground transition-colors">
            {siteCopy.header.navFaq}
          </Link>
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          {loggedIn ? (
            <>
              <span className="text-muted-foreground max-w-[12rem] truncate text-sm">
                {accountState.email || "Signed in"}
              </span>
              <SignOutButton />
            </>
          ) : (
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              {siteCopy.header.signIn}
            </Link>
          )}
          <Link
            href={ctaHref}
            className={cn(buttonVariants({ variant: "default", size: "sm" }))}
          >
            {siteCopy.header.cta}
          </Link>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="sm:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
          <span className="sr-only">{siteCopy.header.menu}</span>
        </Button>
      </div>

      {open ? (
        <div
          id="mobile-nav"
          className="border-border bg-background absolute inset-x-0 top-full z-40 border-b px-4 py-4 shadow-sm sm:hidden"
        >
          <div className="flex flex-col gap-3">
            <Link href="/#benefits" className="text-sm" onClick={() => setOpen(false)}>
              {siteCopy.header.navBenefits}
            </Link>
            <Link href="/#pricing" className="text-sm" onClick={() => setOpen(false)}>
              {siteCopy.header.navPricing}
            </Link>
            <Link href="/#faq" className="text-sm" onClick={() => setOpen(false)}>
              {siteCopy.header.navFaq}
            </Link>
            {loggedIn ? (
              <>
                <p className="text-muted-foreground truncate text-sm">
                  {accountState.email || "Signed in"}
                </p>
                <SignOutButton />
              </>
            ) : (
              <Link
                href="/login"
                className="text-sm font-medium"
                onClick={() => setOpen(false)}
              >
                {siteCopy.header.signIn}
              </Link>
            )}
            <Link
              href={ctaHref}
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "w-full",
              )}
              onClick={() => setOpen(false)}
            >
              {siteCopy.header.cta}
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
