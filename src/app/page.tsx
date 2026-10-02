import Link from "next/link";
import { HeroEditorPreview } from "@/components/marketing/hero-editor-preview";
import { SiteFooter } from "@/components/marketing/site-footer";
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
      <section className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:py-16 lg:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12">
          <div className="max-w-xl">
            <p className="text-brand-deep text-sm font-medium tracking-[0.02em]">
              {siteCopy.home.eyebrow}
            </p>
            <h1 className="font-display mt-4 text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
              {siteCopy.home.headline}
            </h1>
            <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
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
            <p className="text-muted-foreground mt-4 text-sm">
              {siteCopy.home.priceReassurance}
            </p>
          </div>

          <HeroEditorPreview className="w-full lg:justify-self-end" />
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
      <section id="privacy" className="sr-only" aria-hidden>
        Privacy
      </section>
      <section id="terms" className="sr-only" aria-hidden>
        Terms
      </section>
      <SiteFooter />
    </>
  );
}
