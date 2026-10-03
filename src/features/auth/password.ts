import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@/features/auth/constants";
import { siteCopy } from "@/content/site";

/**
 * Server-side (and shared) register password policy.
 * Firebase Auth's default minimum is 6; Prosefield requires 8.
 */
export const registerPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { message: siteCopy.auth.passwordHint });

export type RegisterPasswordResult =
  | { ok: true; password: string }
  | { ok: false; message: string };

/** Reject passwords shorter than PASSWORD_MIN_LENGTH (8). */
export function assertRegisterPassword(password: string): RegisterPasswordResult {
  const parsed = registerPasswordSchema.safeParse(password);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? siteCopy.auth.passwordHint,
    };
  }
  return { ok: true, password: parsed.data };
}
