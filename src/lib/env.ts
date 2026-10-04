import "server-only";

import { z } from "zod";
import {
  applyLocalDevDefaultsToProcessEnv,
  assembleLocalDevEncryptionKek,
  localDevDefaults,
} from "@/lib/env-defaults";

export {
  applyLocalDevDefaultsToProcessEnv,
  assembleLocalDevEncryptionKek,
  localDevDefaults,
};

const booleanFlag = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const nonEmpty = z.string().trim().min(1);

/** Standard base64 encoding of exactly 32 raw bytes (AES-256 KEK). */
const kekBase64 = z
  .string()
  .trim()
  .min(1)
  .superRefine((value, ctx) => {
    const buf = Buffer.from(value, "base64");
    if (buf.byteLength !== 32) {
      ctx.addIssue({
        code: "custom",
        message:
          "must be standard base64 for exactly 32 bytes (AES-256 key material)",
      });
      return;
    }
    // Reject non-canonical / URL-safe encodings so startup validation is strict.
    if (buf.toString("base64") !== value) {
      ctx.addIssue({
        code: "custom",
        message: "must be canonical standard base64 (not URL-safe or padded oddly)",
      });
    }
  });

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
    APP_URL: z
      .string()
      .trim()
      .url()
      .superRefine((value, ctx) => {
        // zod `.url()` already rejects malformed strings; only protocol/host rules here.
        const url = new URL(value);
        const local =
          url.hostname === "localhost" || url.hostname === "127.0.0.1";
        if (url.protocol === "http:" && !local) {
          ctx.addIssue({
            code: "custom",
            message:
              "APP_URL must use https:// outside local dev (localhost / 127.0.0.1)",
          });
        }
      }),
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

    // Document envelope encryption (KEK never stored in Firebase)
    DOCUMENT_ENCRYPTION_PROVIDER: z.enum(["dev", "kms"]).default("dev"),
    // Full uint32 range — wire format stores 4 bytes (no single-byte aliasing).
    DOCUMENT_ENCRYPTION_KEY_VERSION: z.coerce
      .number()
      .int()
      .min(1)
      .max(0xffff_ffff)
      .default(1),
    DOCUMENT_ENCRYPTION_KEK: kekBase64.optional(),
    DOCUMENT_ENCRYPTION_KEK_PREVIOUS: kekBase64.optional(),
    GCP_KMS_KEY_NAME: nonEmpty.optional(),

    // Emulators (optional; point at Docker backend when running)
    FIREBASE_AUTH_EMULATOR_HOST: nonEmpty.optional(),
    FIRESTORE_EMULATOR_HOST: nonEmpty.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.DOCUMENT_ENCRYPTION_PROVIDER === "dev" && !data.DOCUMENT_ENCRYPTION_KEK) {
      ctx.addIssue({
        code: "custom",
        path: ["DOCUMENT_ENCRYPTION_KEK"],
        message:
          "DOCUMENT_ENCRYPTION_KEK is required when DOCUMENT_ENCRYPTION_PROVIDER=dev",
      });
    }
    if (
      data.DOCUMENT_ENCRYPTION_PROVIDER === "kms" &&
      !data.GCP_KMS_KEY_NAME
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["GCP_KMS_KEY_NAME"],
        message:
          "GCP_KMS_KEY_NAME is required when DOCUMENT_ENCRYPTION_PROVIDER=kms",
      });
    }

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

    // Fail closed: production without emulators must use Cloud KMS, never the
    // Compose/dev KEK (including the known filler value from .env.example).
    if (data.DOCUMENT_ENCRYPTION_PROVIDER === "dev") {
      ctx.addIssue({
        code: "custom",
        path: ["DOCUMENT_ENCRYPTION_PROVIDER"],
        message:
          "DOCUMENT_ENCRYPTION_PROVIDER=dev is not allowed in production without ALLOW_EMULATORS=1; use kms with GCP_KMS_KEY_NAME",
      });
    }
    if (data.DOCUMENT_ENCRYPTION_PROVIDER !== "kms" || !data.GCP_KMS_KEY_NAME) {
      ctx.addIssue({
        code: "custom",
        path: ["GCP_KMS_KEY_NAME"],
        message:
          "Production requires DOCUMENT_ENCRYPTION_PROVIDER=kms and GCP_KMS_KEY_NAME",
      });
    }
    const knownDevKek = assembleLocalDevEncryptionKek();
    if (
      data.DOCUMENT_ENCRYPTION_KEK === knownDevKek ||
      data.DOCUMENT_ENCRYPTION_KEK_PREVIOUS === knownDevKek
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["DOCUMENT_ENCRYPTION_KEK"],
        message:
          "Known local/dev DOCUMENT_ENCRYPTION_KEK filler must not be used in production",
      });
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
