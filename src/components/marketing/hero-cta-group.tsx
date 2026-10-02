import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { siteCopy } from "@/content/site";
import { cn } from "@/lib/utils";

type HeroCtaGroupProps = {
  ctaHref: string;
  checkoutReassurance: string;
};

/** Landing hero CTAs + price line (Art Direction §10 / §16). */
export function HeroCtaGroup({
  ctaHref,
  checkoutReassurance,
}: HeroCtaGroupProps) {
  return (
    <>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Link
          href={ctaHref}
          className={cn(
            buttonVariants({ variant: "default", size: "lg" }),
            "w-full sm:w-auto",
          )}
        >
          {siteCopy.header.cta}
        </Link>
        <a
          href="#benefits"
          className={cn(
            buttonVariants({ variant: "secondary", size: "lg" }),
            // Landing-only outlined secondary (v1.1 Paper + Input border).
            // Shared `secondary` stays Soil for other surfaces (e.g. /subscribe).
            "w-full border-input bg-background hover:bg-secondary sm:w-auto",
          )}
        >
          {siteCopy.home.explore}
        </a>
      </div>
      <p className="text-muted-foreground mt-4 text-sm">{checkoutReassurance}</p>
    </>
  );
}
