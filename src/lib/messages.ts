/**
 * User-facing error and empty-state messages (en-GB).
 * Derived from siteCopy so there is one source of truth; prefer this module
 * when wiring empty-state / error UI.
 */

import { siteCopy } from "@/content/site";

export const messages = {
  empty: {
    documentsTitle: siteCopy.documents.emptyTitle,
    documentsBody: siteCopy.documents.emptyBody,
    spellcheckNoSuggestions: siteCopy.documents.spellcheckNoSuggestions,
  },
} as const;

export type Messages = typeof messages;
