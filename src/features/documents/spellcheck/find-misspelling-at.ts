import type { SpellcheckMisspelling } from "@/features/documents/spellcheck/spellcheck-extension";

/** Find a misspelling covering `pos` (inclusive start, exclusive end). */
export function findMisspellingAt(
  misspellings: readonly SpellcheckMisspelling[],
  pos: number,
): SpellcheckMisspelling | null {
  for (const item of misspellings) {
    if (pos >= item.from && pos < item.to) {
      return item;
    }
  }
  // Caret sitting at the end of a word still counts.
  for (const item of misspellings) {
    if (pos === item.to) {
      return item;
    }
  }
  return null;
}
