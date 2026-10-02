import { describe, expect, it } from "vitest";
import { siteCopy } from "@/content/site";
import { mapAuthError } from "@/features/auth/map-auth-error";

describe("mapAuthError", () => {
  it("maps invalid email to the email field", () => {
    expect(mapAuthError("auth/invalid-email")).toEqual({
      field: "email",
      message: "Enter a valid email address.",
    });
  });

  it("maps weak password to the password hint (6+ characters)", () => {
    expect(mapAuthError("auth/weak-password")).toEqual({
      field: "password",
      message: siteCopy.auth.passwordHint,
    });
    expect(siteCopy.auth.passwordHint.toLowerCase()).toContain("6");
  });

  it("maps duplicate email to a field error", () => {
    expect(mapAuthError("auth/email-already-in-use")).toEqual({
      field: "email",
      message: "An account with this email already exists.",
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
