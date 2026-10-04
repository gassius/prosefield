import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  expectSignedIn,
  lookupUidByEmail,
  resetEmulators,
  seedSubscriptionProjection,
  uniqueEmail,
} from "./helpers";

/**
 * Demo GIF recordings for the README. Not a visual-regression gate.
 * Run via `pnpm demo:gifs` against a running app + emulators (prefer production
 * `pnpm start` so the Next.js dev indicator is absent).
 */
test.describe.configure({ mode: "serial" });

const RAW_DIR = path.join(process.cwd(), "test-results", "demo-gifs-raw");

async function preparePage(page: import("@playwright/test").Page): Promise<void> {
  // Hide Next.js dev tools / indicator if present (no-op on production builds).
  await page.addStyleTag({
    content: `
      nextjs-portal, #__next-build-watcher, [data-nextjs-toast],
      [data-nextjs-dialog], [data-next-badge-root] { display: none !important; }
    `,
  });
}

async function saveNamedVideo(
  page: import("@playwright/test").Page,
  name: string,
): Promise<void> {
  mkdirSync(RAW_DIR, { recursive: true });
  const video = page.video();
  if (!video) {
    throw new Error(`No video for ${name}`);
  }
  await page.close();
  const src = await video.path();
  if (!src) {
    throw new Error(`Video path missing for ${name}`);
  }
  copyFileSync(src, path.join(RAW_DIR, `${name}.webm`));
}

test.beforeEach(async () => {
  await resetEmulators();
});

test.use({
  video: {
    mode: "on",
    size: { width: 1280, height: 720 },
  },
  viewport: { width: 1280, height: 720 },
  reducedMotion: "reduce",
});

test("01-landing", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await preparePage(page);
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A writing flow with less friction." }),
  ).toBeVisible();
  await page.waitForTimeout(700);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(500);
  await saveNamedVideo(page, "01-landing");
});

test("02-try-register-pay", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await preparePage(page);
  const heroCta = page
    .locator("section")
    .getByRole("link", { name: "Start your first page" })
    .first();
  await heroCta.click();
  await expect(page).toHaveURL(/\/register/);
  await preparePage(page);

  const email = uniqueEmail("demo-gif");
  const password = "password-123";
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/subscribe/);
  await expectSignedIn(page, email);
  await preparePage(page);

  // Default local .env has no Stripe keys — show Try the editor, then mock pay.
  await expect(page.getByText(/Billing is not configured/i)).toBeVisible();
  await page.getByTestId("try-editor-before-subscribe").click();
  await expect(page).toHaveURL(/\/documents\/trial/);
  await expect(page.getByLabel("Document title")).toBeVisible();
  await page.waitForTimeout(400);

  const uid = await lookupUidByEmail(email, password);
  await seedSubscriptionProjection(uid, "active");
  await page.goto("/documents", { waitUntil: "networkidle" });
  await preparePage(page);
  await expect(
    page.getByRole("heading", { name: "Your first page is waiting." }),
  ).toBeVisible();
  await page.waitForTimeout(500);
  await saveNamedVideo(page, "02-try-register-pay");
});

test("03-document-crud", async ({ page }) => {
  const email = uniqueEmail("demo-crud");
  const password = "password-123";
  await page.goto("/register", { waitUntil: "networkidle" });
  await preparePage(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/subscribe/);
  const uid = await lookupUidByEmail(email, password);
  await seedSubscriptionProjection(uid, "active");

  await page.goto("/documents", { waitUntil: "networkidle" });
  await preparePage(page);
  await page.getByRole("button", { name: "New document" }).click();
  await expect(page).toHaveURL(/\/documents\/[^/]+/);
  await preparePage(page);

  const title = page.getByLabel("Document title");
  await title.fill("Demo notes");
  await title.blur();
  await expect(title).toHaveValue("Demo notes");

  const editor = page.locator("[contenteditable='true']").first();
  await editor.click();
  await page.keyboard.type("Hello from the demo.");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await page.waitForTimeout(400);

  await page.getByRole("button", { name: "Delete document" }).first().click();
  await expect(
    page.getByRole("heading", { name: /Delete “Demo notes”\?/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete document" }).last().click();
  await expect(page).toHaveURL(/\/documents$/);
  await page.waitForTimeout(400);
  await saveNamedVideo(page, "03-document-crud");
});
