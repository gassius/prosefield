"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { siteCopy } from "@/content/site";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetPortal = DialogPrimitive.Portal;

export function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-testid="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-foreground/40 transition-opacity duration-200 ease-[var(--ease-standard)] motion-reduce:transition-none motion-reduce:animate-none",
        "data-[state=open]:opacity-100 data-[state=closed]:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

export function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  side?: "right" | "left";
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        data-testid="sheet-content"
        className={cn(
          "bg-background fixed z-50 flex h-full w-[min(100%,20rem)] flex-col gap-4 border-border p-6 shadow-lg transition-transform duration-200 ease-[var(--ease-standard)] motion-reduce:transition-none motion-reduce:animate-none",
          side === "right" &&
            "inset-y-0 right-0 border-l data-[state=closed]:translate-x-full data-[state=open]:translate-x-0 motion-reduce:data-[state=closed]:translate-x-0",
          side === "left" &&
            "inset-y-0 left-0 border-r data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0 motion-reduce:data-[state=closed]:translate-x-0",
          // Open entrance when motion is allowed (Radix mounts open content once).
          side === "right" &&
            "motion-safe:animate-sheet-in-right motion-reduce:animate-none",
          side === "left" &&
            "motion-safe:animate-sheet-in-left motion-reduce:animate-none",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="ring-offset-background focus-visible:ring-ring absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none">
          <X className="size-5" aria-hidden />
          <span className="sr-only">{siteCopy.header.closeMenu}</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  );
}

export function SheetHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-1.5 pr-8 text-left", className)} {...props} />
  );
}

export function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("font-display text-lg font-medium tracking-tight", className)}
      {...props}
    />
  );
}
