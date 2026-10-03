import { describe, expect, it } from "vitest";
import { siteCopy } from "@/content/site";
import { PASSWORD_MIN_LENGTH } from "@/features/auth/constants";
import { mapAuthError } from "@/features/auth/map-auth-error";

describe("mapAuthError", () => {
  it("maps invalid email to the email field", () => {
    expect(mapAuthError("auth/invalid-email")).toEqual({
      field: "email",
      message: siteCopy.auth.invalidEmail,
    });
  });

  it("maps weak password to the password hint (8+ characters)", () => {
    expect(mapAuthError("auth/weak-password")).toEqual({
      field: "password",
      message: siteCopy.auth.passwordHint,
    });
    expect(siteCopy.auth.passwordHint.toLowerCase()).toContain("8");
    expect(PASSWORD_MIN_LENGTH).toBeGreaterThanOrEqual(8);
  });

  it("maps duplicate email to the generic summary (no account enumeration)", () => {
    expect(mapAuthError("auth/email-already-in-use")).toEqual({
      message: siteCopy.auth.genericError,
    });
  });

  it("maps unknown account and wrong password to the generic summary", () => {
    for (const code of [
      "auth/user-not-found",
      "auth/wrong-password",
      "auth/invalid-credential",
      "auth/invalid-login-credentials",
      "auth/something-else",
      undefined,
    ]) {
      expect(mapAuthError(code)).toEqual({
        message: siteCopy.auth.genericError,
      });
    }
  });
});
