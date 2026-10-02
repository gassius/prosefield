import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { buttonVariants } from "@/components/ui/button";
import { siteCopy } from "@/content/site";
import {
  ctaDestinationForState,
  getAccountState,
} from "@/features/auth/guards";
import { cn } from "@/lib/utils";

export default async function HomePage() {
  const account = await getAccountState();
  const ctaHref = ctaDestinationForState(account);

  return (
    <>
      <SiteHeader accountState={account} ctaHref={ctaHref} />
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-20">
        <p className="text-brand-deep text-sm font-medium tracking-[0.02em]">
          {siteCopy.home.eyebrow}
        </p>
        <h1 className="font-display mt-4 max-w-2xl text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
          {siteCopy.home.headline}
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl text-lg leading-relaxed">
          {siteCopy.home.supporting}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href={ctaHref}
            className={cn(buttonVariants({ variant: "default", size: "lg" }))}
          >
            {siteCopy.header.cta}
          </Link>
          <a
            href="#benefits"
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
          >
            {siteCopy.home.explore}
          </a>
        </div>
      </section>
      <section id="benefits" className="sr-only" aria-hidden>
        Benefits
      </section>
      <section id="pricing" className="sr-only" aria-hidden>
        Pricing
      </section>
      <section id="faq" className="sr-only" aria-hidden>
        FAQ
      </section>
    </>
  );
}
