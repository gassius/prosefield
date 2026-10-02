import { test, expect } from "@playwright/test";
import {
  expectSignedIn,
  lookupUidByEmail,
  registerViaUi,
  resetEmulators,
  seedSubscriptionProjection,
  uniqueEmail,
} from "./helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await resetEmulators();
});

test("upgrade gate: inactive shows Art Direction 12.4; active unlocks documents", async ({
  page,
}) => {
  const email = uniqueEmail("billing-gate");
  await registerViaUi(page, email, "password-123");
  await expect(page).toHaveURL(/\/subscribe/);
  await expectSignedIn(page, email);

  await page.goto("/documents");
  await expect(
    page.getByRole("heading", { name: "Subscribe to start writing" }),
  ).toBeVisible();
  await expect(page.getByText("€8/month", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Continue to secure checkout" }),
  ).toHaveAttribute("href", "/subscribe");
  // No disabled editor teaser.
  await expect(page.getByRole("textbox")).toHaveCount(0);

  const uid = await lookupUidByEmail(email);
  await seedSubscriptionProjection(uid, "active");
  await page.goto("/documents");
  await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Subscribe to start writing" }),
  ).toHaveCount(0);
});

test("/billing/status: pending, failed, and active redirect", async ({ page }) => {
  const email = uniqueEmail("billing-status");
  await registerViaUi(page, email, "password-123");
  await expectSignedIn(page, email);
  const uid = await lookupUidByEmail(email);

  await page.goto("/billing/status");
  await expect(
    page.getByText("Confirming your payment with Stripe…"),
  ).toBeVisible();

  await seedSubscriptionProjection(uid, "unpaid");
  await page.goto("/billing/status");
  await expect(
    page.getByRole("heading", { name: "Payment didn't go through" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

  await seedSubscriptionProjection(uid, "active");
  await page.goto("/billing/status");
  await expect(page).toHaveURL(/\/documents/);
  await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
});

test("/subscribe shows plan and billing-not-configured without real Stripe keys", async ({
  page,
}) => {
  const email = uniqueEmail("billing-subscribe");
  await registerViaUi(page, email, "password-123");
  await expect(page).toHaveURL(/\/subscribe/);
  await expect(
    page.getByRole("heading", { name: "Subscribe to start writing" }),
  ).toBeVisible();
  await expect(page.getByText("€8/month", { exact: true })).toBeVisible();
  await expect(page.getByText(/Billing is not configured/i)).toBeVisible();
});
