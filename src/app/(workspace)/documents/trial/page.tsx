import { redirect } from "next/navigation";
import { TrialWorkspace } from "@/components/documents/trial-workspace";
import {
  ctaDestinationForState,
  getAccountState,
  requireSessionOrRedirect,
} from "@/features/auth/guards";

/**
 * Trial editor for signed-in, unsubscribed users.
 * No Firestore writes — draft lives in the client (sessionStorage across checkout).
 */
export default async function TrialDocumentsPage() {
  await requireSessionOrRedirect("/login?next=/documents/trial");
  const account = await getAccountState();

  if (account.kind === "subscriber") {
    redirect("/documents");
  }
  if (account.kind !== "logged_in") {
    redirect("/login?next=/documents/trial");
  }

  const ctaHref = ctaDestinationForState(account);

  return (
    <TrialWorkspace
      uid={account.uid}
      accountState={account}
      ctaHref={ctaHref}
    />
  );
}
