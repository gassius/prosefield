"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { siteCopy, type FaqItem } from "@/content/site";

type FaqProps = {
  items: FaqItem[];
};

/** FAQ accordion (Art Direction §9.6). */
export function Faq({ items }: FaqProps) {
  return (
    <section id="faq" className="scroll-mt-8 bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20 lg:py-24">
        <div className="text-center">
          <p className="text-brand-deep inline-flex items-center gap-3 text-sm font-medium tracking-[0.02em]">
            <span className="bg-brand block h-px w-6 shrink-0" aria-hidden />
            {siteCopy.faq.eyebrow}
          </p>
          <h2 className="font-display text-foreground mt-4 text-3xl font-medium tracking-tight sm:text-4xl">
            {siteCopy.faq.headline}
          </h2>
        </div>

        <Accordion type="single" collapsible className="mt-10 w-full">
          {items.map((item) => (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
