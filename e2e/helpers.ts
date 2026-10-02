import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

export const AUTH_EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
export const FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
export const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ?? "demo-prosefield";

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${randomUUID()}@example.com`;
}

export async function resetEmulators(): Promise<void> {
  const authUrl = `http://${AUTH_EMULATOR_HOST}/emulator/v1/projects/${FIREBASE_PROJECT_ID}/accounts`;
  const firestoreUrl = `http://${FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

  const [authRes, firestoreRes] = await Promise.all([
    fetch(authUrl, { method: "DELETE" }),
    fetch(firestoreUrl, { method: "DELETE" }),
  ]);

  if (!authRes.ok && authRes.status !== 200) {
    throw new Error(`Auth emulator reset failed: ${authRes.status}`);
  }
  if (!firestoreRes.ok && firestoreRes.status !== 200) {
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
