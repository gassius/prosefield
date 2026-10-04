/**
 * Shared Auth emulator helpers for integration tests.
 * Prefer registerAction (sets pf_pw) for accounts that exchange sessions.
 */
import {
  PASSWORD_POLICY_CLAIM,
  PASSWORD_POLICY_CLAIM_VALUE,
} from "@/features/auth/constants";

function authHost(): string {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!host) {
    throw new Error("FIREBASE_AUTH_EMULATOR_HOST is required");
  }
  return host;
}

/** Direct Identity Toolkit sign-up (no pf_pw claim). Used to prove the session gate. */
export async function signUpViaIdentityToolkit(
  email: string,
  password: string,
): Promise<{ idToken: string; localId: string }> {
  const response = await fetch(
    `http://${authHost()}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `accounts:signUp failed: ${response.status} ${await response.text()}`,
    );
  }
  return (await response.json()) as { idToken: string; localId: string };
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ idToken: string; localId: string }> {
  const response = await fetch(
    `http://${authHost()}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `accounts:signInWithPassword failed: ${response.status} ${await response.text()}`,
    );
  }
  return (await response.json()) as { idToken: string; localId: string };
}

/**
 * Policy-compliant registration: Admin createUser + pf_pw claim, then a fresh
 * ID token via signInWithPassword so the claim is present.
 */
export async function registerAndSignIn(
  email: string,
  password = "password-123",
): Promise<{ idToken: string; localId: string }> {
  const { registerAction } = await import("@/features/auth/register");
  const result = await registerAction({ email, password });
  if (!result.ok) {
    throw new Error(
      `registerAction failed: ${result.message}${result.field ? ` (${result.field})` : ""}`,
    );
  }
  return signInWithPassword(email, password);
}

/** Stamp pf_pw on an existing Auth user and return a fresh ID token. */
export async function grantPasswordPolicyClaimAndRefresh(input: {
  email: string;
  password: string;
  localId: string;
}): Promise<{ idToken: string; localId: string }> {
  const { getAdminAuth } = await import("@/lib/firebase/admin");
  await getAdminAuth().setCustomUserClaims(input.localId, {
    [PASSWORD_POLICY_CLAIM]: PASSWORD_POLICY_CLAIM_VALUE,
  });
  return signInWithPassword(input.email, input.password);
}
