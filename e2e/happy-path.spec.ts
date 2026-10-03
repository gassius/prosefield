import { test, expect } from "@playwright/test";
import {
  expectSignedIn,
  lookupUidByEmail,
  resetEmulators,
  seedSubscriptionProjection,
  uniqueEmail,
} from "./helpers";

/**
 * Architecture §13 / §18 acceptance happy path in one biteable journey:
 * landing → register → mocked pay (seeded projection) → document CRUD.
 * Breaking any step fails the test. No real Stripe network in CI.
 */
test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await resetEmulators();
});

test("happy path: landing → register → mocked pay → create/edit/save/rename/delete", async ({
  page,
}) => {
  // --- Landing ---
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A writing flow with less friction." }),
  ).toBeVisible();
  const heroCta = page
    .locator("section")
    .getByRole("link", { name: "Start your first page" })
    .first();
  await expect(heroCta).toHaveAttribute("href", "/register?next=/subscribe");
  await heroCta.click();

  // --- Register ---
  await expect(page).toHaveURL(/\/register/);
  const email = uniqueEmail("happy");
  const password = "password-123";
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/subscribe/);
  await expectSignedIn(page, email);
  await expect(
    page.getByRole("heading", { name: "Subscribe to start writing" }),
  ).toBeVisible();

  // Upgrade gate still blocks documents before pay.
  await page.goto("/documents");
  await expect(
    page.getByRole("heading", { name: "Subscribe to start writing" }),
  ).toBeVisible();

  // --- Pay (mocked Stripe: seed emulator projection — Architecture §13) ---
  const uid = await lookupUidByEmail(email, password);
  await seedSubscriptionProjection(uid, "active");
  await page.goto("/documents");
  await expect(
    page.getByRole("heading", { name: "Your first page is waiting." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Subscribe to start writing" }),
  ).toHaveCount(0);

  // --- Create ---
  await page.getByRole("button", { name: "New document" }).click();
  await expect(page).toHaveURL(/\/documents\/[^/]+/);
  await expect(page.getByLabel("Document title")).toHaveValue(
    "Untitled document",
  );

  // --- Rename (wait for server confirm: input re-enabled, no alert) ---
  const title = page.getByLabel("Document title");
  await title.fill("Happy path notes");
  await title.blur();
  await expect(title).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(title).toHaveValue("Happy path notes");

  // --- Edit + save ---
  const editor = page.locator("[contenteditable='true']").first();
  await editor.click();
  await page.keyboard.type("Seeded subscriber can write.");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");

  // Persistence bite: reload must still show rename + body from the server.
  await page.reload();
  await expect(page.getByLabel("Document title")).toHaveValue(
    "Happy path notes",
  );
  await expect(page.getByText("Seeded subscriber can write.")).toBeVisible();

  // --- Delete ---
  await page.getByRole("button", { name: "Delete document" }).first().click();
  await expect(
    page.getByRole("heading", { name: /Delete “Happy path notes”\?/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete document" }).last().click();
  await expect(page).toHaveURL(/\/documents$/);
  await expect(page.getByText("Document deleted.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your first page is waiting." }),
  ).toBeVisible();
});
