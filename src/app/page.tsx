import { AssuranceStrip } from "@/components/marketing/assurance-strip";
import { Benefits } from "@/components/marketing/benefits";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { HeroCtaGroup } from "@/components/marketing/hero-cta-group";
import { HeroEditorPreview } from "@/components/marketing/hero-editor-preview";
import { LegalAnchors } from "@/components/marketing/legal-anchors";
import { Pricing } from "@/components/marketing/pricing";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import {
  checkoutReassuranceLine,
  getFaqItems,
  siteCopy,
} from "@/content/site";
import { getPlan } from "@/features/billing/plan";
import {
  ctaDestinationForState,
  getAccountState,
} from "@/features/auth/guards";

export default async function HomePage() {
  const account = await getAccountState();
  const ctaHref = ctaDestinationForState(account);
  const plan = await getPlan();
  const checkoutReassurance = checkoutReassuranceLine(plan.checkoutReassurance);
  const faqItems = getFaqItems();

  return (
    <>
      <SiteHeader accountState={account} ctaHref={ctaHref} />
      <section className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:py-16 lg:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
          <div className="max-w-xl min-w-0">
            <p className="text-brand-deep flex items-center gap-3 text-sm font-medium tracking-[0.02em]">
              <span
                className="bg-brand block h-px w-6 shrink-0"
                aria-hidden
              />
              {siteCopy.home.eyebrow}
            </p>
            <h1 className="font-display mt-4 text-4xl font-medium tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
              {siteCopy.home.headline}
            </h1>
            <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
              {siteCopy.home.supporting}
            </p>
            <HeroCtaGroup
              ctaHref={ctaHref}
              checkoutReassurance={checkoutReassurance}
            />
          </div>

          <HeroEditorPreview className="w-full min-w-0 lg:justify-self-end" />
        </div>
      </section>
      <AssuranceStrip />
      <Benefits />
      <Pricing
        plan={plan}
        ctaHref={ctaHref}
        checkoutReassurance={checkoutReassurance}
      />
      <Faq items={faqItems} />
      <FinalCta ctaHref={ctaHref} checkoutReassurance={checkoutReassurance} />
      <LegalAnchors />
      <SiteFooter />
    </>
  );
}
