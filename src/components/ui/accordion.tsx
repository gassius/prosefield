"use client";

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      className={cn("border-border border-b", className)}
      {...props}
    />
  );
}

export function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "font-display flex flex-1 items-center justify-between gap-4 py-4 text-left text-lg font-medium tracking-tight transition-colors hover:text-brand-deep focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none [&[data-state=open]>svg]:rotate-180 motion-reduce:[&[data-state=open]>svg]:rotate-0",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown
          data-testid="faq-chevron"
          className="text-muted-foreground size-5 shrink-0 transition-transform duration-200 ease-[var(--ease-standard)] motion-reduce:transition-none"
          aria-hidden
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-testid="faq-accordion-content"
      className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm motion-reduce:animate-none motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none"
      {...props}
    >
      <div className={cn("text-muted-foreground pb-4 leading-relaxed", className)}>
        {children}
      </div>
    </AccordionPrimitive.Content>
  );
}
