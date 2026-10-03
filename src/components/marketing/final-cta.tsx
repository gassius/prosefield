import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { siteCopy } from "@/content/site";
import { cn } from "@/lib/utils";

type FinalCtaProps = {
  ctaHref: string;
  checkoutReassurance: string;
};

/** Closing conversion band (Art Direction §9.7). */
export function FinalCta({ ctaHref, checkoutReassurance }: FinalCtaProps) {
  return (
    <section aria-labelledby="final-cta-heading" className="bg-background">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <div className="bg-accent rounded-2xl px-6 py-12 text-center sm:px-10 sm:py-14">
          <h2
            id="final-cta-heading"
            className="font-display text-foreground text-3xl font-medium tracking-tight sm:text-4xl"
          >
            {siteCopy.finalCta.headline}
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-lg text-base leading-relaxed sm:text-lg">
            {siteCopy.finalCta.supporting}
          </p>
          <Link
            href={ctaHref}
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "mt-8 inline-flex",
            )}
          >
            {siteCopy.header.cta}
          </Link>
          <p className="text-muted-foreground mt-3 text-sm">{checkoutReassurance}</p>
        </div>
      </div>
    </section>
  );
}
