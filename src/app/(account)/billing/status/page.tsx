import { redirect } from "next/navigation";
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

  if (view === "active") {
    redirect("/documents");
  }

  const account = await getAccountState();
  const ctaHref = ctaDestinationForState(account);

  const initialView = view === "failed" ? "failed" : "pending";

  return (
    <>
      <SiteHeader accountState={account} ctaHref={ctaHref} />
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
        <BillingStatusClient initialView={initialView} />
      </div>
    </>
  );
}
