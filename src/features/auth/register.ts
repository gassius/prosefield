"use server";

import { siteCopy } from "@/content/site";
import {
  PASSWORD_POLICY_CLAIM,
  PASSWORD_POLICY_CLAIM_VALUE,
} from "@/features/auth/constants";
import { mapAuthError } from "@/features/auth/map-auth-error";
import { registerInputSchema } from "@/features/auth/register-input";
import { getAdminAuth } from "@/lib/firebase/admin";

export type RegisterActionResult =
  | { ok: true }
  | { ok: false; field?: "email" | "password"; message: string };

function firebaseErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: string }).code);
  }
  return undefined;
}

/**
 * Server-side registration: validate password policy, create the Auth user
 * via the Admin SDK, then stamp `pf_pw` so the first ID token after client
 * sign-in carries the session-gate claim.
 */
export async function registerAction(
  input: unknown,
): Promise<RegisterActionResult> {
  const parsed = registerInputSchema.safeParse(input);
  if (!parsed.success) {
    const passwordIssue = parsed.error.issues.find((issue) =>
      issue.path.includes("password"),
    );
    if (passwordIssue) {
      return {
        ok: false,
        field: "password",
        message: passwordIssue.message || siteCopy.auth.passwordHint,
      };
    }
    const emailIssue = parsed.error.issues.find((issue) =>
      issue.path.includes("email"),
    );
    if (emailIssue) {
      return {
        ok: false,
        field: "email",
        message: emailIssue.message || siteCopy.auth.invalidEmail,
      };
    }
    return { ok: false, message: siteCopy.auth.genericError };
  }

  try {
    const auth = getAdminAuth();
    const user = await auth.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    await auth.setCustomUserClaims(user.uid, {
      [PASSWORD_POLICY_CLAIM]: PASSWORD_POLICY_CLAIM_VALUE,
    });
    return { ok: true };
  } catch (error) {
    const code = firebaseErrorCode(error);
    // Admin SDK uses email-already-exists; map alongside client codes.
    const normalized =
      code === "auth/email-already-exists"
        ? "auth/email-already-in-use"
        : code === "auth/invalid-password"
          ? "auth/weak-password"
          : code;
    const mapped = mapAuthError(normalized);
    return { ok: false, field: mapped.field, message: mapped.message };
  }
}
