import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

/** Must match `SESSION_COOKIE_NAME` in src/features/auth/constants.ts. */
const SESSION_COOKIE_NAME = "__session";

export const AUTH_EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
export const FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
export const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ?? "demo-prosefield";

function assertDemoEmulatorTargets(): void {
  if (!FIREBASE_PROJECT_ID.startsWith("demo-")) {
    throw new Error(
      `Refusing emulator reset for non-demo project id: ${FIREBASE_PROJECT_ID}`,
    );
  }
  for (const [label, host] of [
    ["FIREBASE_AUTH_EMULATOR_HOST", AUTH_EMULATOR_HOST],
    ["FIRESTORE_EMULATOR_HOST", FIRESTORE_EMULATOR_HOST],
  ] as const) {
    const hostname = host.split(":")[0] ?? "";
    if (hostname !== "127.0.0.1" && hostname !== "localhost") {
      throw new Error(`${label} must be loopback (got ${host})`);
    }
  }
}

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${randomUUID()}@example.com`;
}

export async function resetEmulators(): Promise<void> {
  assertDemoEmulatorTargets();

  const authUrl = `http://${AUTH_EMULATOR_HOST}/emulator/v1/projects/${FIREBASE_PROJECT_ID}/accounts`;
  const firestoreUrl = `http://${FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

  const [authRes, firestoreRes] = await Promise.all([
    fetch(authUrl, { method: "DELETE" }),
    fetch(firestoreUrl, { method: "DELETE" }),
  ]);

  if (!authRes.ok) {
    throw new Error(`Auth emulator reset failed: ${authRes.status}`);
  }
  if (!firestoreRes.ok) {
    throw new Error(`Firestore emulator reset failed: ${firestoreRes.status}`);
  }
}

export async function registerViaUi(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
}

export async function loginViaUi(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function expectSignedIn(page: Page, email: string): Promise<void> {
  await expect(page.getByText(email)).toBeVisible({ timeout: 20_000 });
}

export async function expectSignedOut(page: Page): Promise<void> {
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
}

export async function expectNoSessionCookie(page: Page): Promise<void> {
  const cookies = await page.context().cookies();
  expect(cookies.find((cookie) => cookie.name === SESSION_COOKIE_NAME)).toBeUndefined();
}

export async function lookupUidByEmail(
  email: string,
  password = "password-123",
): Promise<string> {
  const response = await fetch(
    `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`,
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
      `signIn for uid failed: ${response.status} ${await response.text()}`,
    );
  }
  const body = (await response.json()) as { localId?: string };
  if (!body.localId) {
    throw new Error(`No Auth user for ${email}`);
  }
  return body.localId;
}

/** Test-only shortcut: write the entitlement projection directly (Architecture §13). */
export async function seedSubscriptionProjection(
  uid: string,
  status: string,
): Promise<void> {
  const url = `http://${FIRESTORE_EMULATOR_HOST}/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/subscriptions/${uid}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      Authorization: "Bearer owner",
    },
    body: JSON.stringify({
      fields: {
        status: { stringValue: status },
        stripeCustomerId: { stringValue: "cus_e2e" },
        stripeSubscriptionId: { stringValue: "sub_e2e" },
        stripePriceId: { stringValue: "price_e2e" },
        cancelAtPeriodEnd: { booleanValue: false },
        lastEventId: { stringValue: "evt_e2e_seed" },
      },
    }),
  });
  if (!response.ok) {
    throw new Error(
      `seedSubscriptionProjection failed: ${response.status} ${await response.text()}`,
    );
  }
}
