import Link from "next/link";
import { notFound } from "next/navigation";
import { PageMain } from "@/components/layout/page-main";
import { SiteHeader } from "@/components/marketing/site-header";
import { DocumentsWorkspace } from "@/components/documents/documents-workspace";
import { DocumentEditor } from "@/components/editor/document-editor";
import { buttonVariants } from "@/components/ui/button";
import { siteCopy } from "@/content/site";
import {
  ctaDestinationForState,
  getAccountState,
  requireSessionOrRedirect,
} from "@/features/auth/guards";
import { getPlan } from "@/features/billing/plan";
import { canAccessDocument } from "@/features/documents/ownership";
import {
  getDocumentById,
  listDocumentsForOwner,
} from "@/features/documents/repository";
import { documentIdSchema } from "@/features/documents/schemas";
import { cn } from "@/lib/utils";

type DocumentPageProps = {
  params: Promise<{ documentId: string }>;
};

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { documentId } = await params;
  await requireSessionOrRedirect(
    `/login?next=${encodeURIComponent(`/documents/${documentId}`)}`,
  );
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

  // Reject path traversal / non-id shapes before Firestore lookup (§9).
  if (!documentIdSchema.safeParse(documentId).success) {
    notFound();
  }

  const doc = await getDocumentById(documentId);
  // 404 for missing and non-owned (Architecture §5.5 / §9) — never 403.
  if (!canAccessDocument(doc, account.uid)) {
    notFound();
  }

  const documents = await listDocumentsForOwner(account.uid);
  const entries = documents.map((item) => ({
    id: item.id,
    title: item.title,
    updatedAt: item.updatedAt.toISOString(),
  }));

  return (
    <>
      <SiteHeader accountState={account} ctaHref={ctaHref} />
      <PageMain>
        <div className="border-border flex items-center gap-3 border-b px-4 py-3 md:hidden">
          <Link
            href="/documents"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            {siteCopy.documents.backToList}
          </Link>
        </div>
        <DocumentsWorkspace documents={entries} activeId={doc.id}>
          <DocumentEditor
            documentId={doc.id}
            initialTitle={doc.title}
            initialContent={doc.content}
            contentAllowed={doc.contentAllowed}
          />
        </DocumentsWorkspace>
      </PageMain>
    </>
  );
}
