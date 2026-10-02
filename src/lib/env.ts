import "server-only";

import { z } from "zod";

const booleanFlag = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const nonEmpty = z.string().trim().min(1);

/** Local demo placeholders (same shape as `.env.example`) for bare `pnpm dev`. */
export const localDevDefaults = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-prosefield.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-prosefield",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:0000000000000000000000",
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099",
  APP_URL: "http://localhost:3000",
  FIREBASE_PROJECT_ID: "demo-prosefield",
  STRIPE_SECRET_KEY: "sk_test_replaceme",
  STRIPE_WEBHOOK_SECRET: "whsec_replaceme",
  STRIPE_PRICE_ID: "price_replaceme",
  FEATURE_CUSTOMER_PORTAL: "false",
  PLAN_DISPLAY_NAME: "Prosefield",
  PLAN_DISPLAY_PRICE: "9",
  PLAN_DISPLAY_CURRENCY: "EUR",
  PLAN_DISPLAY_INTERVAL: "month",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
} as const;

export const envSchema = z.object({
  // Public (browser)
  NEXT_PUBLIC_FIREBASE_API_KEY: nonEmpty,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: nonEmpty,
  // TODO(P6): relax demo-prosefield literals when deploying to a real Firebase project.
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.literal("demo-prosefield"),
  NEXT_PUBLIC_FIREBASE_APP_ID: nonEmpty,
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: nonEmpty.optional(),

  // Server
  APP_URL: z.string().trim().url(),
  // TODO(P6): relax demo-prosefield literals when deploying to a real Firebase project.
  FIREBASE_PROJECT_ID: z.literal("demo-prosefield"),
  STRIPE_SECRET_KEY: z
    .string()
    .trim()
    .min(1)
    .regex(/^sk_test_[A-Za-z0-9]+$/, {
      message: "STRIPE_SECRET_KEY must be a Stripe test key (sk_test_…)",
    }),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .trim()
    .min(1)
    .regex(/^whsec_[A-Za-z0-9]+$/, {
      message: "STRIPE_WEBHOOK_SECRET must look like a Stripe webhook secret (whsec_…)",
    }),
  STRIPE_PRICE_ID: nonEmpty,
  FEATURE_CUSTOMER_PORTAL: booleanFlag,

  // Plan display fallback
  PLAN_DISPLAY_NAME: nonEmpty,
  PLAN_DISPLAY_PRICE: nonEmpty,
  PLAN_DISPLAY_CURRENCY: nonEmpty,
  PLAN_DISPLAY_INTERVAL: nonEmpty,

  // Emulators (optional; point at Docker backend when running)
  FIREBASE_AUTH_EMULATOR_HOST: nonEmpty.optional(),
  FIRESTORE_EMULATOR_HOST: nonEmpty.optional(),
});

export type Env = z.infer<typeof envSchema>;

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

/**
 * In non-production, fill missing keys from localDevDefaults so a fresh clone
 * can `pnpm dev` without copying `.env` first. Production still requires real env.
 */
export function mergeEnvSource(
  source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): Record<string, string | undefined> {
  const merged: Record<string, string | undefined> = { ...source };
  if (process.env.NODE_ENV === "production") {
    return merged;
  }
  for (const [key, value] of Object.entries(localDevDefaults)) {
    if (isBlank(merged[key])) {
      merged[key] = value;
    }
  }
  return merged;
}

export function parseEnv(
  source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): Env {
  return envSchema.parse(source);
}

let cached: Env | undefined;

export function getEnv(): Env {
  if (!cached) {
    cached = parseEnv(mergeEnvSource(process.env));
  }
  return cached;
}
