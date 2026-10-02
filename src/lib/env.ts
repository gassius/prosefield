import "server-only";

import { z } from "zod";

const booleanFlag = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const nonEmpty = z.string().trim().min(1);

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
  // TODO(P6): relax demo-prosefield literal when deploying to a real Firebase project.
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

export function parseEnv(
  source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): Env {
  return envSchema.parse(source);
}

let cached: Env | undefined;

export function getEnv(): Env {
  if (!cached) {
    cached = parseEnv();
  }
  return cached;
}
