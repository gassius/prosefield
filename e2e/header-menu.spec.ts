import { test, expect } from "@playwright/test";
import {
  expectSignedIn,
  expectSignedOut,
  lookupUidByEmail,
  registerViaUi,
  resetEmulators,
  seedSubscriptionProjection,
  signOutViaMobileSheet,
  signOutViaUi,
  uniqueEmail,
} from "./helpers";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await resetEmulators();
});

test("logged out landing header keeps Sign in, CTA, and middle nav", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Primary" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Start your first page" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Account menu/i }),
  ).toHaveCount(0);
});

test("signed in, not subscribed: landing keeps nav+CTA; editor drops nav", async ({
  page,
}) => {
  const email = uniqueEmail("header-logged-in");
  await page.setViewportSize({ width: 1280, height: 800 });
  await registerViaUi(page, email, "password-123");
  await expectSignedIn(page, email);

  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Start your first page" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: new RegExp(escapeRegExp(email)) }).first(),
  ).toBeVisible();

  await page.goto("/documents");
  await expect(
    page.getByRole("heading", { name: "Subscribe to start writing" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Start your first page" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: new RegExp(escapeRegExp(email)) }).first(),
  ).toBeVisible();
});

test("subscribed: landing Open the Editor; editor has dropdown only", async ({
  page,
}) => {
  const email = uniqueEmail("header-subscriber");
  await page.setViewportSize({ width: 1280, height: 800 });
  await registerViaUi(page, email, "password-123");
  await expectSignedIn(page, email);
  const uid = await lookupUidByEmail(email);
  await seedSubscriptionProjection(uid, "active");

  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open the Editor" }).first(),
  ).toHaveAttribute("href", "/documents");
  await expect(
    page.getByRole("button", { name: new RegExp(escapeRegExp(email)) }).first(),
  ).toBeVisible();

  await page.goto("/documents");
  await expect(
    page.getByRole("heading", { name: "Your first page is waiting." }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open the Editor" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("link", { name: "Start your first page" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: new RegExp(escapeRegExp(email)) }).first(),
  ).toBeVisible();

  await signOutViaUi(page);
  await expect(page).toHaveURL("/");
  await expectSignedOut(page);
});

test("mobile Sheet account menu signs out at 375", async ({ page }) => {
  const email = uniqueEmail("header-mobile");
  // Register at desktop so expectSignedIn can see the account trigger.
  await page.setViewportSize({ width: 1280, height: 800 });
  await registerViaUi(page, email, "password-123");
  await expectSignedIn(page, email);

  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await signOutViaMobileSheet(page);
  await expect(page).toHaveURL("/");
  await expectSignedOut(page);
});
