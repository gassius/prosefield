import { test, expect } from "@playwright/test";
import {
  expectSignedIn,
  registerViaUi,
  resetEmulators,
  uniqueEmail,
} from "./helpers";

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
  await page.goto(path, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: FREEZE_CSS });
}

test.describe("visual regression", () => {
  test("landing desktop 1440", async ({ page }) => {
    await preparePage(page, "/", { width: 1440, height: 900 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page).toHaveScreenshot("landing-desktop-1440.png", {
      fullPage: true,
      mask: [page.locator("time")],
    });
  });

  test("landing mobile 390", async ({ page }) => {
    await preparePage(page, "/", { width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page).toHaveScreenshot("landing-mobile-390.png", {
      fullPage: true,
      mask: [page.locator("time")],
    });
  });

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
    // Mask the email chip — unique per run.
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
});
