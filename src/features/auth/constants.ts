export const SESSION_COOKIE_NAME = "__session";
export const CSRF_COOKIE_NAME = "csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";

/** Session lifetime: 5 days (Firebase createSessionCookie expiresIn, ms). */
export const SESSION_EXPIRES_IN_MS = 5 * 24 * 60 * 60 * 1000;

/** ID token must have been issued from a sign-in within this window. */
export const RECENT_AUTH_WINDOW_SECONDS = 5 * 60;

/** Minimum password length for register (HTML + copy). */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Custom claim set by registerAction after Admin createUser.
 * Session exchange requires this claim (or grandfathering below).
 */
export const PASSWORD_POLICY_CLAIM = "pf_pw";
export const PASSWORD_POLICY_CLAIM_VALUE = 1;

/**
 * Auth users created before this instant may obtain a session without
 * `pf_pw`. Grandfather by creation time only — no live-project backfill.
 * Fixed to the commit that landed the session gate (2026-10-03T20:00:00Z).
 */
export const PASSWORD_POLICY_GRANDFATHER_BEFORE_MS = Date.parse(
  "2026-10-03T20:00:00.000Z",
);

/** Allow-listed post-auth redirect targets (open-redirect protection). */
export const NEXT_PATH_ALLOW_LIST = [
  "/subscribe",
  "/documents",
] as const;

export type AllowedNextPath = (typeof NEXT_PATH_ALLOW_LIST)[number];
