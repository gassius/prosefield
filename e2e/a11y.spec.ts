import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import {
  expectSignedIn,
  registerViaUi,
  resetEmulators,
  uniqueEmail,
} from "./helpers";

async function expectNoSeriousOrCritical(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

test.describe("accessibility smoke", () => {
  test("landing", async ({ page }) => {
    await page.goto("/");
    await expectNoSeriousOrCritical(page);
  });

  test("login", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await expectNoSeriousOrCritical(page);
  });

  test("register", async ({ page }) => {
    await page.goto("/register");
    await expect(
      page.getByRole("heading", { name: "Create your account" }),
    ).toBeVisible();
    await expectNoSeriousOrCritical(page);
  });

  test("logged-in landing / subscribe", async ({ page }) => {
    await resetEmulators();
    const email = uniqueEmail("a11y");
    await registerViaUi(page, email, "password-123");
    await expectSignedIn(page, email);
    await expectNoSeriousOrCritical(page);
    await page.goto("/");
    await expectNoSeriousOrCritical(page);
  });

  test("subscribe and billing status", async ({ page }) => {
    await resetEmulators();
    const email = uniqueEmail("a11y-billing");
    await registerViaUi(page, email, "password-123");
    await expectSignedIn(page, email);
    await page.goto("/subscribe");
    await expect(
      page.getByRole("heading", { name: "Subscribe to start writing" }),
    ).toBeVisible();
    await expectNoSeriousOrCritical(page);

    await page.goto("/billing/status");
    await expect(
      page.getByText("Confirming your payment with Stripe…"),
    ).toBeVisible();
    await expectNoSeriousOrCritical(page);
  });
});
