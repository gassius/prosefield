"use client";

import { createDocumentAction } from "@/features/documents/actions";
import {
  clearTrialDraft,
  readTrialDraft,
} from "@/features/documents/trial-draft-stash";

export type PersistTrialDraftResult =
  | { ok: true; documentId: string }
  | { ok: false; reason: "none" | "create_failed" };

/**
 * In-flight guard against StrictMode / remount double-create for the same uid.
 * Module-scoped so concurrent callers share one promise.
 */
const inflightByUid = new Map<string, Promise<PersistTrialDraftResult>>();

/**
 * After verified subscription: create the stashed trial draft as a real
 * encrypted document, then clear the client stash. Never logs draft contents.
 * Keeps the stash on failure so the billing-status UI can retry.
 */
export async function persistStashedTrialDraft(
  uid: string,
): Promise<PersistTrialDraftResult> {
  const existing = inflightByUid.get(uid);
  if (existing) {
    return existing;
  }
  const run = doPersist(uid).finally(() => {
    inflightByUid.delete(uid);
  });
  inflightByUid.set(uid, run);
  return run;
}

async function doPersist(uid: string): Promise<PersistTrialDraftResult> {
  const draft = readTrialDraft(uid);
  if (!draft) {
    return { ok: false, reason: "none" };
  }
  try {
    const result = await createDocumentAction({
      title: draft.title,
      content: draft.content,
    });
    if (!result.ok) {
      return { ok: false, reason: "create_failed" };
    }
    clearTrialDraft(uid);
    return { ok: true, documentId: result.data.id };
  } catch {
    return { ok: false, reason: "create_failed" };
  }
}

/** Test-only: reset in-flight map between cases. */
export function __resetPersistInflightForTests(): void {
  inflightByUid.clear();
}
