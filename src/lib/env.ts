import "server-only";

import { z } from "zod";

const booleanFlag = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

export const envSchema = z.object({
  // Public (browser)
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.literal("demo-prosefield"),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: z.string().min(1).optional(),

  // Server
  APP_URL: z.string().url(),
  FIREBASE_PROJECT_ID: z.literal("demo-prosefield"),
  STRIPE_SECRET_KEY: z
    .string()
    .min(1)
    .refine((value) => value.startsWith("sk_test_"), {
      message: "STRIPE_SECRET_KEY must be a Stripe test key (sk_test_…)",
    }),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_ID: z.string().min(1),
  FEATURE_CUSTOMER_PORTAL: booleanFlag,

  // Plan display fallback
  PLAN_DISPLAY_NAME: z.string().min(1),
  PLAN_DISPLAY_PRICE: z.string().min(1),
  PLAN_DISPLAY_CURRENCY: z.string().min(1),
  PLAN_DISPLAY_INTERVAL: z.string().min(1),

  // Emulators (set by compose / native scripts)
  FIREBASE_AUTH_EMULATOR_HOST: z.string().min(1).optional(),
  FIRESTORE_EMULATOR_HOST: z.string().min(1).optional(),
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
