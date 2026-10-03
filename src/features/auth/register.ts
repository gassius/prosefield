"use server";

import { siteCopy } from "@/content/site";
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
 * Server-side registration: validate password policy, then create the Auth user
 * via the Admin SDK. The client signs in afterward with the same credentials.
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
        message: emailIssue.message || "Enter a valid email address.",
      };
    }
    return { ok: false, message: siteCopy.auth.genericError };
  }

  try {
    await getAdminAuth().createUser({
      email: parsed.data.email,
      password: parsed.data.password,
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
