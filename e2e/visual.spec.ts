import { test, expect } from "@playwright/test";
import {
  expectSignedIn,
  lookupUidByEmail,
  registerViaUi,
  resetEmulators,
  seedSubscriptionProjection,
  uniqueEmail,
} from "./helpers";

// Baselines must be generated/compared inside scripts/test-visual.sh
// (official Playwright Docker image). Refuse host runs and generic containers.
test.beforeAll(async () => {
  // Require the marker set only by scripts/test-visual.sh — /.dockerenv alone
  // (e.g. a random devcontainer) must not pass.
  if (process.env.PROSEFIELD_VISUAL_DOCKER !== "1") {
    throw new Error(
      "Visual tests must run via `pnpm test:visual` / `pnpm test:visual:update` (Playwright Docker image marker PROSEFIELD_VISUAL_DOCKER=1).",
    );
  }
});
const FREEZE_CSS = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
  }
`;

async function preparePage(
  page: import("@playwright/test").Page,
  path: string,
  viewport: { width: number; height: number },
) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(viewport);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: FREEZE_CSS });
}

const LANDING_VISUAL_WIDTHS = [375, 768, 1024, 1440] as const;

test.describe("visual regression", () => {
  for (const width of LANDING_VISUAL_WIDTHS) {
    test(`landing ${width}`, async ({ page }) => {
      await preparePage(page, "/", { width, height: 900 });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page).toHaveScreenshot(`landing-${width}.png`, {
        fullPage: true,
        mask: [page.locator("time")],
      });
    });
  }

  test("login", async ({ page }) => {
    await preparePage(page, "/login", { width: 1440, height: 900 });
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await expect(page).toHaveScreenshot("login-desktop.png", {
      fullPage: true,
    });
  });

  test("register", async ({ page }) => {
    await preparePage(page, "/register", { width: 1440, height: 900 });
    await expect(
      page.getByRole("heading", { name: "Create your account" }),
    ).toBeVisible();
    await expect(page).toHaveScreenshot("register-desktop.png", {
      fullPage: true,
    });
  });

  test("logged-in subscribe (home CTA target)", async ({ page }) => {
    await resetEmulators();
    const email = uniqueEmail("visual");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await registerViaUi(page, email, "password-123");
    await expectSignedIn(page, email);
    await page.addStyleTag({ content: FREEZE_CSS });
    await expect(page).toHaveScreenshot("logged-in-subscribe.png", {
      fullPage: true,
      mask: [page.getByText(email), page.locator("time")],
    });

    await preparePage(page, "/", { width: 1440, height: 900 });
    await expect(page).toHaveScreenshot("logged-in-landing.png", {
      fullPage: true,
      mask: [page.getByText(email), page.locator("time")],
    });
  });

  test("billing status pending", async ({ page }) => {
    await resetEmulators();
    const email = uniqueEmail("visual-billing");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await registerViaUi(page, email, "password-123");
    await expectSignedIn(page, email);
    await preparePage(page, "/billing/status", { width: 1440, height: 900 });
    await expect(
      page.getByText("Confirming your payment with Stripe…"),
    ).toBeVisible();
    await expect(page).toHaveScreenshot("billing-status-pending.png", {
      fullPage: true,
      mask: [page.getByText(email), page.locator("time")],
    });
  });

  test("documents empty state", async ({ page }) => {
    await resetEmulators();
    const email = uniqueEmail("visual-docs-empty");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await registerViaUi(page, email, "password-123");
    await expectSignedIn(page, email);
    const uid = await lookupUidByEmail(email);
    await seedSubscriptionProjection(uid, "active");
    await preparePage(page, "/documents", { width: 1440, height: 900 });
    await expect(
      page.getByRole("heading", { name: "Your first page is waiting." }),
    ).toBeVisible();
    await expect(page).toHaveScreenshot("documents-empty.png", {
      fullPage: true,
      mask: [page.getByText(email), page.locator("time")],
    });
  });

  test("documents editor and delete dialog", async ({ page }) => {
    await resetEmulators();
    const email = uniqueEmail("visual-docs-editor");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await registerViaUi(page, email, "password-123");
    await expectSignedIn(page, email);
    const uid = await lookupUidByEmail(email);
    await seedSubscriptionProjection(uid, "active");
    await page.goto("/documents");
    await page.getByRole("button", { name: "New document" }).click();
    await expect(page.getByLabel("Document title")).toBeVisible();
    await page.addStyleTag({ content: FREEZE_CSS });
    await expect(page).toHaveScreenshot("documents-editor.png", {
      fullPage: true,
      mask: [page.getByText(email), page.locator("time")],
    });

    await page.getByRole("button", { name: "Delete document" }).first().click();
    await expect(page.getByRole("heading", { name: /Delete/ })).toBeVisible();
    await expect(page).toHaveScreenshot("documents-delete-dialog.png", {
      fullPage: true,
      mask: [page.getByText(email), page.locator("time")],
    });
  });
});
