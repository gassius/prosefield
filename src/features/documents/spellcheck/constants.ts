/** Spellcheck debounce after typing pauses (acceptance: ~300ms). */
export const SPELLCHECK_DEBOUNCE_MS = 300;

/** Max suggestions shown in the popover. */
export const SPELLCHECK_MAX_SUGGESTIONS = 5;

/** Zod / persist bounds for ignored words (Architecture + ClickUp 869fd9py1). */
export const IGNORED_WORDS_MAX = 500;
export const IGNORED_WORD_MAX_LENGTH = 64;

/** Lazy-loaded Hunspell assets (vendored under public/). */
export const SPELLCHECK_DICT_AFF_URL = "/spellcheck/en.aff";
export const SPELLCHECK_DICT_DIC_URL = "/spellcheck/en.dic";
