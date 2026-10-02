import { HeroCtaGroup } from "@/components/marketing/hero-cta-group";
import { HeroEditorPreview } from "@/components/marketing/hero-editor-preview";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { siteCopy } from "@/content/site";
import { getPlan } from "@/features/billing/plan";
import {
  ctaDestinationForState,
  getAccountState,
} from "@/features/auth/guards";

export default async function HomePage() {
  const account = await getAccountState();
  const ctaHref = ctaDestinationForState(account);
  const plan = await getPlan();

  return (
    <>
      <SiteHeader accountState={account} ctaHref={ctaHref} />
      <section className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:py-16 lg:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
          <div className="max-w-xl">
            <p className="text-brand-deep flex items-center gap-3 text-sm font-medium tracking-[0.02em]">
              <span
                className="bg-brand block h-px w-6 shrink-0"
                aria-hidden
              />
              {siteCopy.home.eyebrow}
            </p>
            <h1 className="font-display mt-4 text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
              {siteCopy.home.headline}
            </h1>
            <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
              {siteCopy.home.supporting}
            </p>
            <HeroCtaGroup
              ctaHref={ctaHref}
              checkoutReassurance={plan.checkoutReassurance}
            />
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
