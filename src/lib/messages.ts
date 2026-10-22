/**
 * User-facing error and empty-state messages (en-GB).
 * Prefer this module over hard-coding those strings in UI components.
 */

export const messages = {
  errors: {
    network: "Something went wrong. Please try again.",
    saveFailed: "Save failed. Try again.",
    signOut: "We couldn't sign you out. Please try again.",
  },
  empty: {
    documentsTitle: "Your first page is waiting.",
    documentsBody: "Create a document to start writing.",
    notFoundTitle: "Page not found",
    notFoundBody: "That page isn’t here. Head home to keep writing.",
    spellcheckNoSuggestions: "No suggestions",
  },
} as const;

export type Messages = typeof messages;
