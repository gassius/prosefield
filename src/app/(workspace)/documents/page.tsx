import Link from "next/link";
import { PageMain } from "@/components/layout/page-main";
import { SiteHeader } from "@/components/marketing/site-header";
import { DocumentsWorkspace } from "@/components/documents/documents-workspace";
import { buttonVariants } from "@/components/ui/button";
import { siteCopy } from "@/content/site";
import {
  ctaDestinationForState,
  getAccountState,
  requireSessionOrRedirect,
} from "@/features/auth/guards";
import { getPlan } from "@/features/billing/plan";
import { listDocumentsForOwner } from "@/features/documents/repository";
import { cn } from "@/lib/utils";

export default async function DocumentsPage() {
  await requireSessionOrRedirect("/login?next=/documents");
  const account = await getAccountState();
  const ctaHref = ctaDestinationForState(account);

  if (account.kind !== "subscriber") {
    const plan = await getPlan();
    return (
      <>
        <SiteHeader accountState={account} ctaHref={ctaHref} />
        <PageMain className="justify-center">
          <div className="mx-auto flex w-full max-w-lg flex-col px-6 py-16">
            <div className="rounded-xl border border-border bg-background p-8">
              <h1 className="font-display text-xl font-medium tracking-tight sm:text-2xl">
                {siteCopy.documents.upgradeTitle}
              </h1>
              <p className="text-muted-foreground mt-3 text-base leading-relaxed">
                {siteCopy.documents.upgradeBody}
              </p>
              <p className="mt-4 text-base font-medium text-foreground">
                {plan.priceLabel}
              </p>
              <Link
                href="/subscribe"
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "mt-8 inline-flex",
                )}
              >
                {siteCopy.documents.upgradeCta}
              </Link>
            </div>
          </div>
        </PageMain>
      </>
    );
  }

  const documents = await listDocumentsForOwner(account.uid);
  const entries = documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    updatedAt: doc.updatedAt.toISOString(),
  }));

  return (
    <>
      <SiteHeader accountState={account} ctaHref={ctaHref} />
      <PageMain>
        <DocumentsWorkspace documents={entries} />
      </PageMain>
    </>
  );
}
