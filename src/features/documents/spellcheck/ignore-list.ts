import {
  IGNORED_WORD_MAX_LENGTH,
  IGNORED_WORDS_MAX,
} from "@/features/documents/spellcheck/constants";

/** Normalise for case-insensitive ignore matching. */
export function normaliseIgnoredWord(word: string): string {
  return word.trim().toLowerCase();
}

export function isWordIgnored(
  word: string,
  ignored: ReadonlySet<string> | readonly string[],
): boolean {
  const key = normaliseIgnoredWord(word);
  if (!key) {
    return false;
  }
  if (ignored instanceof Set) {
    return ignored.has(key);
  }
  return ignored.some((entry) => normaliseIgnoredWord(entry) === key);
}

/**
 * Add a word to the ignore list (case-insensitive dedupe).
 * Enforces max count / max length; returns previous list unchanged if rejected.
 */
export function addIgnoredWord(
  ignored: readonly string[],
  word: string,
): string[] {
  const normalised = normaliseIgnoredWord(word);
  if (
    !normalised ||
    normalised.length > IGNORED_WORD_MAX_LENGTH ||
    ignored.some((entry) => normaliseIgnoredWord(entry) === normalised)
  ) {
    return [...ignored];
  }
  if (ignored.length >= IGNORED_WORDS_MAX) {
    return [...ignored];
  }
  return [...ignored, normalised];
}

export function ignoredWordsSet(ignored: readonly string[]): Set<string> {
  return new Set(ignored.map(normaliseIgnoredWord).filter(Boolean));
}
