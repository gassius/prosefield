import type { AllowedNextPath } from "@/features/auth/constants";

export type AccountState =
  | { kind: "logged_out" }
  | {
      kind: "logged_in";
      uid: string;
      email: string;
      /** Firebase Auth display name when set; otherwise null. */
      displayName: string | null;
      subscriptionActive: false;
    }
  | {
      kind: "subscriber";
      uid: string;
      email: string;
      /** Firebase Auth display name when set; otherwise null. */
      displayName: string | null;
      subscriptionActive: true;
    };

export type CtaDestination =
  | AllowedNextPath
  | `/register?next=${AllowedNextPath}`;

export type SignedInAccount = Exclude<AccountState, { kind: "logged_out" }>;

export function ctaDestinationForState(state: AccountState): CtaDestination {
  switch (state.kind) {
    case "logged_out":
      return "/register?next=/subscribe";
    case "logged_in":
      return "/subscribe";
    case "subscriber":
      return "/documents";
  }
}

/** Display name when present, otherwise email (caller supplies empty fallback). */
export function accountDisplayLabel(state: SignedInAccount): string {
  const name = state.displayName?.trim();
  if (name) {
    return name;
  }
  return state.email.trim();
}
