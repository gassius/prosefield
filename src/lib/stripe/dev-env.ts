/**
 * Dev-only helpers for Stripe local tooling (`.env` upsert + test-key checks).
 * Never log secret values from callers.
 */

const TEST_SECRET_PREFIXES = ["sk_test_", "rk_test_"] as const;
const LIVE_SECRET_PREFIXES = ["sk_live_", "rk_live_"] as const;

const ENV_LINE =
  /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/** Detect EOL style used in the file (CRLF vs LF). Empty → LF. */
export function detectEnvEol(content: string): "\n" | "\r\n" {
  return content.includes("\r\n") ? "\r\n" : "\n";
}

/**
 * True when `line` is an assignment for exactly `key` (not a comment, not a
 * longer key that shares a prefix).
 */
function isExactKeyAssign(line: string, key: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return false;
  }
  const keyAssign = new RegExp(
    `^\\s*(?:export\\s+)?${escapeRegExp(key)}\\s*=`,
  );
  return keyAssign.test(line);
}

/** Read a single KEY from dotenv-style file contents (last match wins, like Node). */
export function getEnvKey(content: string, key: string): string | undefined {
  let found: string | undefined;
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = ENV_LINE.exec(line);
    if (!match || match[1] !== key) {
      continue;
    }
    found = stripWrappingQuotes(match[2]).trim();
  }
  return found;
}

/**
 * Insert or replace KEY=value in dotenv-style contents.
 * Preserves comments, blank lines, ordering, and unrelated keys.
 * Preserves CRLF vs LF. Skips commented `# KEY=` lines.
 * Does not match longer keys that share a prefix (e.g. `KEY_OLD=`).
 * When duplicates exist, leaves exactly one assignment (last position) —
 * matching Node/dotenv last-wins semantics.
 */
export function upsertEnvKey(
  content: string,
  key: string,
  value: string,
): string {
  const eol = detectEnvEol(content);
  const hadTrailingNewline =
    content.endsWith("\n") || content.endsWith("\r\n");
  const lines = content.length === 0 ? [] : content.split(/\r?\n/);
  if (hadTrailingNewline && lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  const matchIndexes: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isExactKeyAssign(lines[i]!, key)) {
      matchIndexes.push(i);
    }
  }

  let next: string[];
  if (matchIndexes.length === 0) {
    next = [...lines, `${key}=${value}`];
  } else {
    const keepAt = matchIndexes[matchIndexes.length - 1]!;
    const drop = new Set(matchIndexes.slice(0, -1));
    next = [];
    for (let i = 0; i < lines.length; i++) {
      if (drop.has(i)) {
        continue;
      }
      if (i === keepAt) {
        next.push(`${key}=${value}`);
      } else {
        next.push(lines[i]!);
      }
    }
  }

  const body = next.join(eol);
  if (content.length === 0) {
    return `${body}${eol}`;
  }
  if (matchIndexes.length === 0) {
    return `${body}${eol}`;
  }
  return hadTrailingNewline ? `${body}${eol}` : body;
}

export function isStripeLiveSecretKey(key: string): boolean {
  return LIVE_SECRET_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function isStripeTestSecretKey(key: string): boolean {
  if (!key || key.includes("replaceme")) {
    return false;
  }
  return (
    TEST_SECRET_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
    key.length > "sk_test_".length
  );
}

/**
 * Validate STRIPE_SECRET_KEY for local seed/setup tooling.
 * Accepts sk_test_ / rk_test_; refuses live keys and placeholders.
 */
export function assertStripeTestSecretKey(
  key: string | undefined,
): asserts key is string {
  const trimmed = key?.trim();
  if (!trimmed) {
    throw new Error(
      "Missing STRIPE_SECRET_KEY. Set a test key (sk_test_… or rk_test_…) in .env, then re-run.",
    );
  }
  if (isStripeLiveSecretKey(trimmed)) {
    throw new Error(
      "Refusing to run: STRIPE_SECRET_KEY is a live key (sk_live_/rk_live_). Use a test key (sk_test_… or rk_test_…).",
    );
  }
  if (!isStripeTestSecretKey(trimmed)) {
    throw new Error(
      "Refusing to run: STRIPE_SECRET_KEY must be a Stripe test key (sk_test_… or rk_test_…).",
    );
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
