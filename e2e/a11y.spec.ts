import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import {
  expectSignedIn,
  lookupUidByEmail,
  registerViaUi,
  resetEmulators,
  seedSubscriptionProjection,
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

const LANDING_WIDTHS = [375, 768, 1024, 1440] as const;

test.describe("accessibility smoke", () => {
  for (const width of LANDING_WIDTHS) {
    test(`landing ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoSeriousOrCritical(page);

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: Math.max(doc.scrollWidth, document.body.scrollWidth),
          clientWidth: doc.clientWidth,
        };
      });
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
    });
  }

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

  test("not-found has a main landmark", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
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

    await page
      .getByRole("button", {
        name: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      })
      .first()
      .click();
    await expect(page.getByRole("menu")).toBeVisible();
    await expectNoSeriousOrCritical(page);
  });

  test("subscribed landing Open the Editor header", async ({ page }) => {
    await resetEmulators();
    const email = uniqueEmail("a11y-subscriber");
    await registerViaUi(page, email, "password-123");
    await expectSignedIn(page, email);
    const uid = await lookupUidByEmail(email);
    await seedSubscriptionProjection(uid, "active");
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Open the Editor" }).first(),
    ).toBeVisible();
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

  test("documents empty, editor, and delete dialog", async ({ page }) => {
    await resetEmulators();
    const email = uniqueEmail("a11y-docs");
    await registerViaUi(page, email, "password-123");
    await expectSignedIn(page, email);
    const uid = await lookupUidByEmail(email);
    await seedSubscriptionProjection(uid, "active");

    await page.goto("/documents");
    await expect(
      page.getByRole("heading", { name: "Your first page is waiting." }),
    ).toBeVisible();
    await expectNoSeriousOrCritical(page);

    await page.getByRole("button", { name: "New document" }).click();
    await expect(page.getByLabel("Document title")).toBeVisible();
    await expectNoSeriousOrCritical(page);

    await page.getByRole("button", { name: "Delete document" }).first().click();
    await expect(page.getByRole("heading", { name: /Delete/ })).toBeVisible();
    await expectNoSeriousOrCritical(page);
  });

  for (const width of [375, 768, 1280] as const) {
    test(`trial subscribe and leave modals ${width}px`, async ({ page }) => {
      await resetEmulators();
      const email = uniqueEmail(`a11y-trial-${width}`);
      // Desktop register first (email is hidden in the mobile header chrome).
      await page.setViewportSize({ width: 1280, height: 900 });
      await registerViaUi(page, email, "password-123");
      await expectSignedIn(page, email);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/documents/trial");
      await expect(page.getByLabel("Document title")).toBeVisible();
      await expectNoSeriousOrCritical(page);

      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByTestId("trial-subscribe-modal")).toBeVisible();
      await expectNoSeriousOrCritical(page);
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("trial-subscribe-modal")).toHaveCount(0);

      const editable = page.locator("[contenteditable='true']");
      await editable.click();
      await page.keyboard.type("A11y leave draft body");
      await expect(page.getByText("Unsaved changes")).toBeVisible();
      // surface=app: CTA is the leave-guard link (in Sheet below sm).
      if (width < 640) {
        await page.getByRole("button", { name: "Open menu" }).click();
        await page.getByRole("link", { name: "Start your first page" }).click();
      } else {
        await page
          .getByRole("link", { name: "Start your first page" })
          .first()
          .click();
      }
      await expect(page.getByTestId("trial-leave-modal")).toBeVisible();
      await expectNoSeriousOrCritical(page);
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("trial-leave-modal")).toHaveCount(0);
    });
  }
});
