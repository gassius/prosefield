import { siteCopy } from "@/content/site";

export type MappedAuthError = {
  field?: "email" | "password";
  message: string;
};

/** Map Firebase Auth error codes to Art Direction 12.7 field / summary copy. */
export function mapAuthError(code: string | undefined): MappedAuthError {
  switch (code) {
    case "auth/invalid-email":
      return { field: "email", message: "Enter a valid email address." };
    case "auth/weak-password":
      return {
        field: "password",
        message: siteCopy.auth.passwordHint,
      };
    // Do not reveal whether an email is already registered (same copy as bad login).
    case "auth/email-already-in-use":
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-login-credentials":
      return { message: siteCopy.auth.genericError };
    default:
      return { message: siteCopy.auth.genericError };
  }
}
