import "server-only";

/**
 * Demo GIF recording helpers.
 *
 * `PROSEFIELD_DEMO_GIFS=1` applies non-placeholder Stripe fixtures and points
 * the SDK at the loopback prices mock — only on a strict local allow-list.
 * Anywhere else (Vercel, self-hosted production, non-loopback hosts) the flag
 * throws so startup exits non-zero. Never redirects real Stripe keys to
 * loopback. Does not alter `isBillingConfigured` itself.
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

export class DemoGifsBillingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DemoGifsBillingError";
  }
}

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

function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname);
}

/** `host:port` or bare host — host part must be loopback. */
function emulatorHostIsLoopback(value: string | undefined): boolean {
  if (isBlank(value)) {
    return false;
  }
  const raw = value!.trim();
  let host = raw;
  if (raw.startsWith("[")) {
    const end = raw.indexOf("]");
    host = end >= 0 ? raw.slice(1, end) : raw;
  } else {
    // IPv4 / hostname: take segment before first colon (port).
    const colon = raw.indexOf(":");
    host = colon >= 0 ? raw.slice(0, colon) : raw;
  }
  return isLoopbackHostname(host);
}

function appUrlIsLoopback(appUrl: string | undefined): boolean {
  if (isBlank(appUrl)) {
    return false;
  }
  try {
    return isLoopbackHostname(new URL(appUrl!.trim()).hostname);
  } catch {
    return false;
  }
}

/**
 * Strict local allow-list for demo GIF billing fixtures.
 * All must hold: no Vercel, emulator-capable env, loopback emulators + APP_URL.
 */
export function isDemoGifsLocalAllowList(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  // Any non-blank VERCEL means we are on the Vercel platform (preview/prod/dev).
  if (!isBlank(env.VERCEL)) {
    return false;
  }
  const emulatorCapable =
    env.ALLOW_EMULATORS === "1" || env.NODE_ENV !== "production";
  if (!emulatorCapable) {
    return false;
  }
  if (!emulatorHostIsLoopback(env.FIREBASE_AUTH_EMULATOR_HOST)) {
    return false;
  }
  if (!emulatorHostIsLoopback(env.FIRESTORE_EMULATOR_HOST)) {
    return false;
  }
  if (!appUrlIsLoopback(env.APP_URL)) {
    return false;
  }
  return true;
}

/**
 * True only when the flag is set and the local allow-list holds.
 * If the flag is set outside that allow-list, throws (fail closed / loud).
 * Flag unset → false (no throw).
 */
export function isDemoGifsBillingMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  if (env.PROSEFIELD_DEMO_GIFS !== "1") {
    return false;
  }
  if (!isDemoGifsLocalAllowList(env)) {
    throw new DemoGifsBillingError(
      "PROSEFIELD_DEMO_GIFS=1 is only allowed for local emulator demo GIF recording (VERCEL unset, ALLOW_EMULATORS=1 or non-production NODE_ENV, loopback APP_URL and emulator hosts). Refusing to start.",
    );
  }
  return true;
}

/**
 * Apply demo Stripe fixtures + loopback API host when demo GIF mode is on.
 * - Flag off → no-op (false).
 * - Flag on outside allow-list → throws.
 * - Non-placeholder Stripe credentials present → throws (never redirect real keys).
 * - Blank/placeholder Stripe vars on the allow-list → filled with demo fixtures.
 */
export function applyDemoGifsBillingEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  if (!isDemoGifsBillingMode(env)) {
    return false;
  }

  const stripeValues = [
    env.STRIPE_SECRET_KEY,
    env.STRIPE_WEBHOOK_SECRET,
    env.STRIPE_PRICE_ID,
  ];
  if (stripeValues.some((value) => !looksPlaceholder(value))) {
    throw new DemoGifsBillingError(
      "PROSEFIELD_DEMO_GIFS=1 refuses to point non-placeholder Stripe credentials at the loopback mock. Unset real Stripe keys (use placeholders) or unset PROSEFIELD_DEMO_GIFS.",
    );
  }

  env.STRIPE_SECRET_KEY = DEMO_GIFS_STRIPE_SECRET_KEY;
  env.STRIPE_WEBHOOK_SECRET = DEMO_GIFS_STRIPE_WEBHOOK_SECRET;
  env.STRIPE_PRICE_ID = DEMO_GIFS_STRIPE_PRICE_ID;
  env.STRIPE_API_HOST = "127.0.0.1";
  env.STRIPE_API_PORT = "12111";
  env.STRIPE_API_PROTOCOL = "http";

  return true;
}
