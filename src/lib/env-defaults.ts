/**
 * Local demo placeholders (same shape as `.env.example`) for bare `pnpm dev`.
 * Shared by `next.config.ts` (no `server-only`) and `src/lib/env.ts`.
 */
export const localDevDefaults = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-prosefield.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-prosefield",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:0000000000000000000000",
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  APP_URL: "http://localhost:3000",
  FIREBASE_PROJECT_ID: "demo-prosefield",
  STRIPE_SECRET_KEY: "sk_test_replaceme",
  STRIPE_WEBHOOK_SECRET: "whsec_replaceme",
  STRIPE_PRICE_ID: "price_replaceme",
  FEATURE_CUSTOMER_PORTAL: "false",
  PLAN_DISPLAY_NAME: "Prosefield",
  PLAN_DISPLAY_PRICE: "8",
  PLAN_DISPLAY_CURRENCY: "EUR",
  PLAN_DISPLAY_INTERVAL: "month",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
} as const;

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

/**
 * Copy localDevDefaults into `process.env` for blank keys (non-production).
 * Needed so firebase-admin and NEXT_PUBLIC_* (via next.config) see emulator hosts
 * without a `.env` file.
 */
export function applyLocalDevDefaultsToProcessEnv(
  target: NodeJS.ProcessEnv = process.env,
): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  for (const [key, value] of Object.entries(localDevDefaults)) {
    if (isBlank(target[key])) {
      target[key] = value;
    }
  }
}
