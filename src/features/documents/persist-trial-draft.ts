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
 * After verified subscription: create the stashed trial draft as a real
 * encrypted document, then clear the client stash. Never logs draft contents.
 */
export async function persistStashedTrialDraft(
  uid: string,
): Promise<PersistTrialDraftResult> {
  const draft = readTrialDraft(uid);
  if (!draft) {
    return { ok: false, reason: "none" };
  }
  const result = await createDocumentAction({
    title: draft.title,
    content: draft.content,
  });
  if (!result.ok) {
    return { ok: false, reason: "create_failed" };
  }
  clearTrialDraft(uid);
  return { ok: true, documentId: result.data.id };
}
