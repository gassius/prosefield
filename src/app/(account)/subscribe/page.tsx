import { CheckoutButton } from "@/components/billing/checkout-button";
import { SiteHeader } from "@/components/marketing/site-header";
import { siteCopy } from "@/content/site";
import {
  ctaDestinationForState,
  getAccountState,
  requireSessionOrRedirect,
} from "@/features/auth/guards";
import { isBillingConfigured, BILLING_NOT_CONFIGURED_MESSAGE } from "@/features/billing/configured";
import { getPlan } from "@/features/billing/plan";
import { redirect } from "next/navigation";

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSessionOrRedirect("/login?next=/subscribe");
  const account = await getAccountState();
  if (account.kind === "subscriber") {
    redirect("/documents");
  }

  const params = await searchParams;
  const plan = await getPlan();
  const configured = isBillingConfigured();
  const showNotConfigured =
    !configured || params.error === "not_configured";
  const ctaHref = ctaDestinationForState(account);

  return (
    <>
      <SiteHeader accountState={account} ctaHref={ctaHref} />
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
        <h1 className="font-display text-3xl font-medium tracking-tight">
          {siteCopy.subscribe.title}
        </h1>
        <p className="text-muted-foreground mt-3 text-base leading-relaxed">
          {siteCopy.subscribe.body}
        </p>
        <p className="mt-4 text-base font-medium text-foreground">
          {plan.priceLabel}
        </p>
        {showNotConfigured ? (
          <p
            className="bg-warning-soft text-foreground mt-6 rounded-lg px-4 py-3 text-sm leading-relaxed"
            role="status"
          >
            {BILLING_NOT_CONFIGURED_MESSAGE}
          </p>
        ) : (
          <div className="mt-8">
            <CheckoutButton label={siteCopy.subscribe.checkoutCta} />
          </div>
        )}
        <p className="text-muted-foreground mt-4 text-sm">
          {plan.checkoutReassurance}
        </p>
      </div>
    </>
  );
}
