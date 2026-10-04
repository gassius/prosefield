import { PageMain } from "@/components/layout/page-main";
import { SiteHeader } from "@/components/marketing/site-header";
import {
  ctaDestinationForState,
  getAccountState,
  requireSessionOrRedirect,
} from "@/features/auth/guards";
import { resolveBillingStatusView } from "@/features/billing/session-sync";
import { BillingStatusClient } from "./billing-status-client";

export default async function BillingStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const session = await requireSessionOrRedirect(
    "/login?next=/billing/status",
  );
  const params = await searchParams;
  const sessionId =
    typeof params.session_id === "string" ? params.session_id : null;

  const { view } = await resolveBillingStatusView({
    uid: session.uid,
    sessionId,
  });

  const account = await getAccountState();
  const ctaHref = ctaDestinationForState(account);

  // Always render the client for `active` so a stashed trial draft can be
  // persisted before navigating into the editor (sessionStorage is client-only).
  const initialView =
    view === "active" ? "active" : view === "failed" ? "failed" : "pending";

  return (
    <>
      <SiteHeader accountState={account} ctaHref={ctaHref} />
      <PageMain className="justify-center">
        <div className="mx-auto flex w-full max-w-lg flex-col px-6 py-16">
          <BillingStatusClient initialView={initialView} uid={session.uid} />
        </div>
      </PageMain>
    </>
  );
}
