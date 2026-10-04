import "server-only";

const EMAIL_RE =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PASSWORD_KEY_RE =
  /^(password|passwd|pwd|secret|token|authorization|cookie|__session)$/i;
const CONTENT_KEY_RE =
  /^(content|title|ciphertext|plaintext|documentContent|body)$/i;

const REDACTED = "[REDACTED]";

function redactString(value: string): string {
  return value.replace(EMAIL_RE, REDACTED);
}

/**
 * Deep-clone a value for logs/error reports with PII and document content removed.
 * Never log the return of this helper's inverse — there isn't one.
 */
export function redactForLog(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return REDACTED;
  }
  if (value == null) {
    return value;
  }
  if (typeof value === "string") {
    return redactString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (PASSWORD_KEY_RE.test(key) || CONTENT_KEY_RE.test(key)) {
        out[key] = REDACTED;
        continue;
      }
      out[key] = redactForLog(nested, depth + 1);
    }
    return out;
  }
  return REDACTED;
}
