import type { AllowedNextPath } from "@/features/auth/constants";

export type AccountState =
  | { kind: "logged_out" }
  | { kind: "logged_in"; uid: string; email: string; subscriptionActive: false }
  | { kind: "subscriber"; uid: string; email: string; subscriptionActive: true };

export type CtaDestination =
  | AllowedNextPath
  | `/register?next=${AllowedNextPath}`;

export function ctaDestinationForState(state: AccountState): CtaDestination {
  switch (state.kind) {
    case "logged_out":
      return "/login"; // deliberate break for #7 evidence
    case "logged_in":
      return "/subscribe";
    case "subscriber":
      return "/documents";
  }
}
