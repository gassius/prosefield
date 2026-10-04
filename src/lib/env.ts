import "server-only";

import { z } from "zod";
import {
  applyLocalDevDefaultsToProcessEnv,
  localDevDefaults,
} from "@/lib/env-defaults";

export { applyLocalDevDefaultsToProcessEnv, localDevDefaults };

const booleanFlag = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const nonEmpty = z.string().trim().min(1);

export const envSchema = z
  .object({
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
      .regex(/^(sk_test_|rk_test_)[A-Za-z0-9]+$/, {
        message:
          "STRIPE_SECRET_KEY must be a Stripe test key (sk_test_… or rk_test_…)",
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
  })
  .superRefine((data, ctx) => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }
    // Local/CI `pnpm start` against Docker emulators must set ALLOW_EMULATORS=1.
    // Real production deploys must omit emulator hosts (unsigned tokens otherwise).
    if (process.env.ALLOW_EMULATORS === "1") {
      return;
    }
    const emulatorKeys = [
      "FIREBASE_AUTH_EMULATOR_HOST",
      "FIRESTORE_EMULATOR_HOST",
      "NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST",
    ] as const;
    for (const key of emulatorKeys) {
      if (data[key]) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `${key} must not be set in production without ALLOW_EMULATORS=1 (Admin SDK accepts unsigned tokens in emulator mode)`,
        });
      }
    }
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

/** Test-only: clear the cached env parse. */
export function __resetEnvCacheForTests(): void {
  cached = undefined;
}
