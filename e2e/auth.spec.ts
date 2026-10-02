import { test, expect } from "@playwright/test";
import {
  expectSignedIn,
  expectSignedOut,
  loginViaUi,
  registerViaUi,
  resetEmulators,
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

test("register with an existing email shows an error", async ({ page }) => {
  const email = uniqueEmail("dup");
  await registerViaUi(page, email, "password-123");
  await expect(page).toHaveURL(/\/subscribe/);

  await page.goto("/register");
  // Already signed in redirects away — sign out first.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expectSignedOut(page);

  await registerViaUi(page, email, "password-123");
  await expect(
    page.getByText("An account with this email already exists."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/register/);
});

test("login succeeds; wrong password and unknown account show errors", async ({
  page,
}) => {
  const email = uniqueEmail("login");
  await registerViaUi(page, email, "password-123");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expectSignedOut(page);

  await loginViaUi(page, email, "wrong-password");
  await expect(
    page.getByRole("alert").filter({ hasText: "Email or password is incorrect." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  await loginViaUi(page, uniqueEmail("unknown"), "password-123");
  await expect(
    page.getByRole("alert").filter({ hasText: "Email or password is incorrect." }),
  ).toBeVisible();

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

  await page.getByRole("button", { name: "Sign out" }).click();
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
  const loggedOutCta = page
    .locator("section")
    .getByRole("link", { name: "Start your first page" });
  await expect(loggedOutCta).toHaveAttribute(
    "href",
    "/register?next=/subscribe",
  );

  const email = uniqueEmail("cta");
  await registerViaUi(page, email, "password-123");
  await expect(page).toHaveURL(/\/subscribe/);
  await expectSignedIn(page, email);

  await page.goto("/");
  await expectSignedIn(page, email);
  const loggedInCta = page
    .locator("section")
    .getByRole("link", { name: "Start your first page" });
  await expect(loggedInCta).toHaveAttribute("href", "/subscribe");
});
