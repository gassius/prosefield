import {
  NEXT_PATH_ALLOW_LIST,
  type AllowedNextPath,
} from "@/features/auth/constants";

const allowSet = new Set<string>(NEXT_PATH_ALLOW_LIST);

/**
 * Validate `next` query values against the internal allow-list.
 * Returns `fallback` when missing or not allow-listed.
 */
export function resolveNextPath(
  raw: string | null | undefined,
  fallback: AllowedNextPath = "/subscribe",
): AllowedNextPath {
  if (!raw) {
    return fallback;
  }

  // Reject absolute URLs, protocol-relative, and anything with a query/hash.
  if (
    raw.includes("://") ||
    raw.startsWith("//") ||
    raw.includes("?") ||
    raw.includes("#") ||
    !raw.startsWith("/")
  ) {
    return fallback;
  }

  if (allowSet.has(raw)) {
    return raw as AllowedNextPath;
  }

  return fallback;
}
