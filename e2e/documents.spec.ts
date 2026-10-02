import { test, expect } from "@playwright/test";
import {
  expectSignedIn,
  loginViaUi,
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

async function registerActiveSubscriber(page: import("@playwright/test").Page) {
  const email = uniqueEmail("docs");
  const password = "password-123";
  await registerViaUi(page, email, password);
  await expectSignedIn(page, email);
  const uid = await lookupUidByEmail(email, password);
  await seedSubscriptionProjection(uid, "active");
  await page.goto("/documents");
  return { email, password };
}

test("CRUD: create, edit, save, rename, delete", async ({ page }) => {
  await registerActiveSubscriber(page);

  await expect(
    page.getByRole("heading", { name: "Your first page is waiting." }),
  ).toBeVisible();

  await page.getByRole("button", { name: "New document" }).click();
  await expect(page).toHaveURL(/\/documents\/[^/]+/);
  await expect(page.getByLabel("Document title")).toHaveValue(
    "Untitled document",
  );

  const title = page.getByLabel("Document title");
  await title.fill("Project brief");
  await title.blur();
  await expect(title).toHaveValue("Project brief");

  const editor = page.locator(".ProseMirror, .prosefield-editor .tiptap, [contenteditable='true']").first();
  await editor.click();
  await page.keyboard.type("Hello from the field.");
  await expect(page.getByText("Unsaved changes")).toBeVisible();

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Delete document" }).first().click();
  await expect(
    page.getByRole("heading", { name: /Delete “Project brief”\?/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.getByRole("heading", { name: /Delete “Project brief”\?/ }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Delete document" }).first().click();
  await page.getByRole("button", { name: "Delete document" }).last().click();
  await expect(page).toHaveURL(/\/documents$/);
  await expect(page.getByText("Document deleted.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your first page is waiting." }),
  ).toBeVisible();
});

test("persistence across logout and login", async ({ page }) => {
  const { email, password } = await registerActiveSubscriber(page);

  await page.getByRole("button", { name: "New document" }).click();
  await expect(page).toHaveURL(/\/documents\/[^/]+/);

  const title = page.getByLabel("Document title");
  await title.fill("Persisted notes");
  await title.blur();

  const editor = page.locator("[contenteditable='true']").first();
  await editor.click();
  await page.keyboard.type("Survives the session.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  const url = page.url();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();

  await loginViaUi(page, email, password);
  await expectSignedIn(page, email);
  await page.goto(url);
  await expect(page.getByLabel("Document title")).toHaveValue("Persisted notes");
  await expect(page.getByText("Survives the session.")).toBeVisible();
});

test("Ctrl/Cmd+S saves from unsaved state", async ({ page }) => {
  await registerActiveSubscriber(page);
  await page.getByRole("button", { name: "New document" }).click();
  await expect(page).toHaveURL(/\/documents\/[^/]+/);

  const editor = page.locator("[contenteditable='true']").first();
  await editor.click();
  await page.keyboard.type("Shortcut save");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.keyboard.press("Control+s");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
});
