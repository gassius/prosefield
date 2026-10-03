import Link from "next/link";
import { Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatPricingCardPrice, siteCopy } from "@/content/site";
import type { PlanDisplay } from "@/features/billing/plan-display";
import { cn } from "@/lib/utils";

type PricingProps = {
  plan: PlanDisplay;
  ctaHref: string;
  checkoutReassurance: string;
};

/** Single-plan pricing from getPlan() (Art Direction §9.5). */
export function Pricing({ plan, ctaHref, checkoutReassurance }: PricingProps) {
  return (
    <section id="pricing" className="scroll-mt-8 bg-secondary/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-center lg:gap-14 lg:py-24">
        <div className="max-w-xl">
          <p className="text-brand-deep flex items-center gap-3 text-sm font-medium tracking-[0.02em]">
            <span className="bg-brand block h-px w-6 shrink-0" aria-hidden />
            {siteCopy.pricing.eyebrow}
          </p>
          <h2 className="font-display text-foreground mt-4 text-3xl font-medium tracking-tight sm:text-4xl">
            {siteCopy.pricing.headline}
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed sm:text-lg">
            {siteCopy.pricing.supporting}
          </p>
        </div>

        <div className="border-border bg-card text-card-foreground rounded-xl border p-6 shadow-[0_12px_40px_-16px_rgba(27,29,33,0.16)] sm:p-8">
          <p className="bg-accent text-accent-foreground inline-flex rounded-md px-2.5 py-1 text-xs font-medium tracking-[0.02em]">
            {siteCopy.pricing.badge}
          </p>
          <p
            data-testid="pricing-card-price"
            className="font-display text-foreground mt-4 text-4xl font-medium tracking-tight"
          >
            {formatPricingCardPrice(plan.priceLabel)}
          </p>
          <ul className="mt-6 space-y-3">
            {siteCopy.pricing.benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2.5 text-sm">
                <Check
                  className="text-success mt-0.5 size-4 shrink-0"
                  strokeWidth={2.25}
                  aria-hidden
                />
                <span className="text-foreground leading-snug">{benefit}</span>
              </li>
            ))}
          </ul>
          <Link
            href={ctaHref}
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "mt-8 w-full",
            )}
          >
            {siteCopy.header.cta}
          </Link>
          <p className="text-muted-foreground mt-3 text-center text-sm">
            {checkoutReassurance}
          </p>
        </div>
      </div>
    </section>
  );
}
