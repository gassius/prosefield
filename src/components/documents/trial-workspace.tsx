"use client";

import { useCallback } from "react";
import { PageMain } from "@/components/layout/page-main";
import { SiteHeader } from "@/components/marketing/site-header";
import { TrialEditor } from "@/components/documents/trial-editor";
import {
  UnsavedLeaveGuardProvider,
} from "@/components/documents/unsaved-leave-guard";
import type {
  AccountState,
  CtaDestination,
} from "@/features/auth/account-state";
import { clearTrialDraft } from "@/features/documents/trial-draft-stash";

type TrialWorkspaceProps = {
  uid: string;
  accountState: AccountState;
  ctaHref: CtaDestination;
};

/**
 * Trial editor shell: leave-guard wraps header (sign-out / nav) and editor.
 */
export function TrialWorkspace({
  uid,
  accountState,
  ctaHref,
}: TrialWorkspaceProps) {
  const onDiscard = useCallback(() => {
    clearTrialDraft(uid);
  }, [uid]);

  return (
    <UnsavedLeaveGuardProvider onDiscard={onDiscard}>
      <SiteHeader accountState={accountState} ctaHref={ctaHref} />
      <PageMain>
        <TrialEditor uid={uid} />
      </PageMain>
    </UnsavedLeaveGuardProvider>
  );
}
