/**
 * Tokenise plain text into word spans for spellchecking.
 * Skips URLs, emails, numbers, ALL-CAPS tokens, and words with digits.
 */

export type WordToken = {
  word: string;
  from: number;
  to: number;
};

const WORD_RE = /[A-Za-z][A-Za-z']*/g;

const URL_RE = /\bhttps?:\/\/\S+/gi;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const NUMBER_RE = /\b\d+(?:[.,]\d+)*\b/g;

function rangesToSkip(text: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (const re of [URL_RE, EMAIL_RE, NUMBER_RE]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  return ranges;
}

function overlapsSkip(
  from: number,
  to: number,
  skips: Array<{ start: number; end: number }>,
): boolean {
  for (const range of skips) {
    if (from < range.end && to > range.start) {
      return true;
    }
  }
  return false;
}

/** True when the token should not be spellchecked. */
export function shouldSkipToken(word: string): boolean {
  if (word.length === 0) {
    return true;
  }
  // ALL-CAPS (acronyms) — require at least 2 letters.
  if (word.length >= 2 && word === word.toUpperCase() && /[A-Z]/.test(word)) {
    return true;
  }
  // Digits anywhere (product codes, versions mixed into words).
  if (/\d/.test(word)) {
    return true;
  }
  return false;
}

/**
 * Return word tokens with absolute offsets into `text`.
 * Offsets are UTF-16 code unit indices (JS string indexing).
 */
export function tokenizeForSpellcheck(text: string): WordToken[] {
  const skips = rangesToSkip(text);
  const tokens: WordToken[] = [];
  WORD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WORD_RE.exec(text)) !== null) {
    const word = match[0];
    const from = match.index;
    const to = from + word.length;
    if (overlapsSkip(from, to, skips)) {
      continue;
    }
    if (shouldSkipToken(word)) {
      continue;
    }
    tokens.push({ word, from, to });
  }
  return tokens;
}
