export const SESSION_COOKIE_NAME = "__session";
export const CSRF_COOKIE_NAME = "csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";

/** Session lifetime: 5 days (Firebase createSessionCookie expiresIn, ms). */
export const SESSION_EXPIRES_IN_MS = 5 * 24 * 60 * 60 * 1000;

/** ID token must have been issued from a sign-in within this window. */
export const RECENT_AUTH_WINDOW_SECONDS = 5 * 60;

/** Allow-listed post-auth redirect targets (open-redirect protection). */
export const NEXT_PATH_ALLOW_LIST = [
  "/subscribe",
  "/documents",
] as const;

export type AllowedNextPath = (typeof NEXT_PATH_ALLOW_LIST)[number];
