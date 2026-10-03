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

/** Read a single KEY from dotenv-style file contents (first match wins). */
export function getEnvKey(content: string, key: string): string | undefined {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = ENV_LINE.exec(line);
    if (!match || match[1] !== key) {
      continue;
    }
    return stripWrappingQuotes(match[2]).trim();
  }
  return undefined;
}

/**
 * Insert or replace KEY=value in dotenv-style contents.
 * Preserves comments, blank lines, ordering, and unrelated keys.
 * Does not append a trailing newline if the original had none (except when
 * appending a new key to non-empty content, which always ends with `\n`).
 */
export function upsertEnvKey(
  content: string,
  key: string,
  value: string,
): string {
  const hadTrailingNewline = content.endsWith("\n");
  const lines = content.length === 0 ? [] : content.split(/\r?\n/);
  // split keeps a final empty string when content ends with \n — drop it for editing
  if (hadTrailingNewline && lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  const keyAssign = new RegExp(`^\\s*(?:export\\s+)?${escapeRegExp(key)}\\s*=`);
  let replaced = false;
  const next = lines.map((line) => {
    if (!replaced && keyAssign.test(line)) {
      replaced = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!replaced) {
    next.push(`${key}=${value}`);
  }

  const body = next.join("\n");
  if (content.length === 0) {
    return `${body}\n`;
  }
  if (!replaced) {
    // Newly appended key always terminates the file with a newline.
    return `${body}\n`;
  }
  return hadTrailingNewline ? `${body}\n` : body;
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
