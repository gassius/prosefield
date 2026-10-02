"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";
import { ProsefieldLogo } from "@/components/brand/prosefield-logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

const navLinks = [
  { href: "/#benefits", label: siteCopy.header.navBenefits },
  { href: "/#pricing", label: siteCopy.header.navPricing },
  { href: "/#faq", label: siteCopy.header.navFaq },
] as const;

export function SiteHeader({ accountState, ctaHref }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  const loggedIn = accountState.kind !== "logged_out";

  return (
    <header className="border-border bg-background/95 relative border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <ProsefieldLogo />

        <nav
          className="text-muted-foreground hidden items-center gap-6 text-sm sm:flex"
          aria-label={siteCopy.header.primaryNav}
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          {loggedIn ? (
            <>
              <span className="text-muted-foreground max-w-[12rem] truncate text-sm">
                {accountState.email || siteCopy.header.signedInFallback}
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

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "sm:hidden",
            )}
            aria-controls="mobile-nav"
          >
            <Menu className="size-5" aria-hidden />
            <span className="sr-only">{siteCopy.header.menu}</span>
          </SheetTrigger>
          <SheetContent
            id="mobile-nav"
            side="right"
            className="sm:hidden"
            aria-describedby={undefined}
          >
            <SheetHeader>
              <SheetTitle>{siteCopy.header.menuTitle}</SheetTitle>
            </SheetHeader>
            <nav
              className="flex flex-col gap-3"
              aria-label={siteCopy.header.mobileNav}
            >
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-foreground py-2 text-sm font-medium"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              {loggedIn ? (
                <>
                  <p className="text-muted-foreground truncate text-sm">
                    {accountState.email || siteCopy.header.signedInFallback}
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
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
