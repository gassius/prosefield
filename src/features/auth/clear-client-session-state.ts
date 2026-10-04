/**
 * Client-side cleanup that runs after a successful sign-out (and can be
 * reused by #29's shared `use-sign-out` hook). Keeps trial-draft clearing
 * out of individual buttons so every surface clears the stash.
 *
 * Never logs draft contents.
 */
import { clearAllTrialDrafts } from "@/features/documents/trial-draft-stash";

export function clearClientSessionState(): void {
  clearAllTrialDrafts();
}
