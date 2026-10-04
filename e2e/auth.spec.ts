import { test, expect } from "@playwright/test";
import {
  expectNoSessionCookie,
  expectSignedIn,
  expectSignedOut,
  loginViaUi,
  registerViaUi,
  resetEmulators,
  signOutViaUi,
  uniqueEmail,
} from "./helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await resetEmulators();
});

test("registers a new account and lands on subscribe with a session", async ({
  page,
}) => {
  const email = uniqueEmail("register");
  await registerViaUi(page, email, "password-123");
  await expect(page).toHaveURL(/\/subscribe/);
  await expectSignedIn(page, email);
  await expect(
    page.getByRole("heading", { name: "Subscribe to start writing" }),
  ).toBeVisible();
});

test("register rejects a 7-character password before creating an account", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Email").fill(uniqueEmail("short-pw"));
  const password = page.getByLabel("Password");
  await password.fill("abcdefg");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(password).toHaveAttribute("aria-invalid", "true");
  await expect(password).toHaveAttribute("aria-describedby", /-error$/);
  await expect(page).toHaveURL(/\/register/);
  await expectNoSessionCookie(page);
});

test("register rejects 123456, stays on the page, and shows the hint error", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Email").fill(uniqueEmail("firebase-default-pw"));
  const password = page.getByLabel("Password");
  await password.fill("123456");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(password).toHaveAttribute("aria-invalid", "true");
  await expect(password).toHaveAttribute("aria-describedby", /-error$/);
  await expect(page).toHaveURL(/\/register/);
  await expectNoSessionCookie(page);
});

test("register with an existing email shows a generic error", async ({ page }) => {
  const email = uniqueEmail("dup");
  await registerViaUi(page, email, "password-123");
  await expect(page).toHaveURL(/\/subscribe/);

  await page.goto("/register");
  // Already signed in redirects away — sign out first.
  await signOutViaUi(page);
  await expectSignedOut(page);

  await registerViaUi(page, email, "password-123");
  await expect(
    page.getByRole("alert").filter({ hasText: "Email or password is incorrect." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/register/);
});

test("login succeeds; wrong password and unknown account show errors", async ({
  page,
}) => {
  const email = uniqueEmail("login");
  await registerViaUi(page, email, "password-123");
  await signOutViaUi(page);
  await expectSignedOut(page);

  await loginViaUi(page, email, "wrong-password");
  await expect(
    page.getByRole("alert").filter({ hasText: "Email or password is incorrect." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  await expectNoSessionCookie(page);
  await page.goto("/subscribe");
  await expect(page).toHaveURL(/\/login/);

  await loginViaUi(page, uniqueEmail("unknown"), "password-123");
  await expect(
    page.getByRole("alert").filter({ hasText: "Email or password is incorrect." }),
  ).toBeVisible();
  await expectNoSessionCookie(page);
  await page.goto("/subscribe");
  await expect(page).toHaveURL(/\/login/);

  await loginViaUi(page, email, "password-123");
  await expect(page).toHaveURL(/\/subscribe/);
  await expectSignedIn(page, email);
});

test("logout clears the session and protected routes redirect to login", async ({
  page,
}) => {
  const email = uniqueEmail("logout");
  await registerViaUi(page, email, "password-123");
  await expect(page).toHaveURL(/\/subscribe/);

  await signOutViaUi(page);
  await expect(page).toHaveURL("/");
  await expectSignedOut(page);

  await page.goto("/subscribe");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/documents");
  await expect(page).toHaveURL(/\/login/);
});

test("landing CTAs route correctly when logged out and logged in", async ({
  page,
}) => {
  await page.goto("/");
  const loggedOutCtas = page
    .locator("section")
    .getByRole("link", { name: "Start your first page" });
  await expect(loggedOutCtas.first()).toHaveAttribute(
    "href",
    "/register?next=/subscribe",
  );
  // Hero, pricing, and final CTA share the same state-aware destination.
  await expect(loggedOutCtas).toHaveCount(3);
  for (const href of await loggedOutCtas.evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href")),
  )) {
    expect(href).toBe("/register?next=/subscribe");
  }

  const email = uniqueEmail("cta");
  await registerViaUi(page, email, "password-123");
  await expect(page).toHaveURL(/\/subscribe/);
  await expectSignedIn(page, email);

  await page.goto("/");
  await expectSignedIn(page, email);
  const loggedInCtas = page
    .locator("section")
    .getByRole("link", { name: "Start your first page" });
  await expect(loggedInCtas).toHaveCount(3);
  for (const href of await loggedInCtas.evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href")),
  )) {
    expect(href).toBe("/subscribe");
  }
});
