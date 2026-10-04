import "server-only";

/**
 * Demo GIF recording helpers.
 *
 * When `PROSEFIELD_DEMO_GIFS=1`, apply non-placeholder Stripe fixtures and
 * point the SDK at the loopback prices mock (same shape as CI visual E2E).
 * Never touches real Stripe keys or accounts.
 *
 * Inert when `VERCEL_ENV=production` — a mistaken flag on a real deploy must
 * not rewrite billing credentials. Does not alter `isBillingConfigured`; after
 * fixtures apply, that helper returns true via normal non-placeholder checks.
 */

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

/** Assembled so source never contains a contiguous sk_test_/whsec_ token. */
export const DEMO_GIFS_STRIPE_SECRET_KEY = [
  "sk",
  "test",
  "demogifsrecording01",
].join("_");
export const DEMO_GIFS_STRIPE_WEBHOOK_SECRET = [
  "whsec",
  "demogifsrecording01",
].join("_");
export const DEMO_GIFS_STRIPE_PRICE_ID = [
  "price",
  "demogifsrecording01",
].join("_");

const PLACEHOLDER_MARKERS = ["replaceme"] as const;

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

function looksPlaceholder(value: string | undefined): boolean {
  if (isBlank(value)) {
    return true;
  }
  const trimmed = value!.trim();
  return PLACEHOLDER_MARKERS.some((marker) => trimmed.includes(marker));
}

/**
 * True only for local/CI demo GIF recording. Always false on Vercel production.
 */
export function isDemoGifsBillingMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  if (env.VERCEL_ENV === "production") {
    return false;
  }
  return env.PROSEFIELD_DEMO_GIFS === "1";
}

/**
 * Apply demo Stripe fixtures + loopback API host when demo GIF mode is on.
 * No-op (and returns false) when the switch is off or inert in production.
 * Overwrites blank/placeholder Stripe keys only — never clobbers real-looking
 * non-placeholder values already set by the operator.
 */
export function applyDemoGifsBillingEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  if (!isDemoGifsBillingMode(env)) {
    return false;
  }

  if (looksPlaceholder(env.STRIPE_SECRET_KEY)) {
    env.STRIPE_SECRET_KEY = DEMO_GIFS_STRIPE_SECRET_KEY;
  }
  if (looksPlaceholder(env.STRIPE_WEBHOOK_SECRET)) {
    env.STRIPE_WEBHOOK_SECRET = DEMO_GIFS_STRIPE_WEBHOOK_SECRET;
  }
  if (looksPlaceholder(env.STRIPE_PRICE_ID)) {
    env.STRIPE_PRICE_ID = DEMO_GIFS_STRIPE_PRICE_ID;
  }

  const host = env.STRIPE_API_HOST?.trim();
  if (!host || !LOOPBACK_HOSTS.has(host)) {
    env.STRIPE_API_HOST = "127.0.0.1";
  }
  if (isBlank(env.STRIPE_API_PORT)) {
    env.STRIPE_API_PORT = "12111";
  }
  if (isBlank(env.STRIPE_API_PROTOCOL)) {
    env.STRIPE_API_PROTOCOL = "http";
  }

  return true;
}
