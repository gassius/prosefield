/**
 * Client-side cleanup that runs after a successful sign-out from
 * {@link useSignOut}. Keeps trial-draft clearing in one place so every
 * surface (AccountMenu desktop/Sheet, SignOutButton) clears the stash.
 *
 * Never logs draft contents.
 */
import { clearAllTrialDrafts } from "@/features/documents/trial-draft-stash";

export function clearClientSessionState(): void {
  clearAllTrialDrafts();
}
