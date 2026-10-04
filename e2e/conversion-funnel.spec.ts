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

async function openTrialEditor(
  page: import("@playwright/test").Page,
  email: string,
) {
  await registerViaUi(page, email, "password-123");
  await expectSignedIn(page, email);
  await expect(page).toHaveURL(/\/subscribe/);
  await page.getByTestId("try-editor-before-subscribe").click();
  await expect(page).toHaveURL(/\/documents\/trial/);
  await expect(page.getByLabel("Document title")).toBeVisible();
}

test("checkout success keeps the same draft saved and enables editor functions", async ({
  page,
}) => {
  const email = uniqueEmail("funnel-success");
  await openTrialEditor(page, email);
  const uid = await lookupUidByEmail(email);

  const title = page.getByLabel("Document title");
  await title.fill("Funnel kept draft");
  await title.blur();
  const editable = page.locator("[contenteditable='true']");
  await editable.click();
  await page.keyboard.type("Words that survive checkout");

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("trial-subscribe-modal")).toBeVisible();

  // Mock Stripe Checkout: stash runs client-side, then we land on billing status.
  await page.route("**/api/checkout", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        url: `${new URL(page.url()).origin}/billing/status?session_id=cs_test_funnel`,
      }),
    });
  });

  // B1: any native dialog (including beforeunload "Leave site?") fails the test.
  page.on("dialog", (dialog) => {
    throw new Error(`Unexpected dialog during checkout: ${dialog.type()} ${dialog.message()}`);
  });

  await page
    .getByTestId("trial-subscribe-modal")
    .getByRole("button", { name: "Continue to secure checkout" })
    .click();

  await seedSubscriptionProjection(uid, "active");
  await expect(page).toHaveURL(/\/documents\//, { timeout: 20_000 });
  await expect(page.getByLabel("Document title")).toHaveValue(
    "Funnel kept draft",
  );
  await expect(editable).toHaveText(/Words that survive checkout/);

  // All functions enabled: Save should persist without opening the trial modal.
  await editable.click();
  await page.keyboard.type("!");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("trial-subscribe-modal")).toHaveCount(0);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
});

test("subscriber visiting /documents/trial is redirected to /documents", async ({
  page,
}) => {
  const email = uniqueEmail("funnel-sub-redirect");
  await registerViaUi(page, email, "password-123");
  await expectSignedIn(page, email);
  const uid = await lookupUidByEmail(email);
  await seedSubscriptionProjection(uid, "active");
  await page.goto("/documents/trial");
  await expect(page).toHaveURL(/\/documents$/);
});

test("checkout cancel keeps the draft in the trial editor", async ({ page }) => {
  const email = uniqueEmail("funnel-cancel");
  await openTrialEditor(page, email);

  const title = page.getByLabel("Document title");
  await title.fill("Cancel keeps me");
  await title.blur();
  const editable = page.locator("[contenteditable='true']");
  await editable.click();
  await page.keyboard.type("Still here after cancel");

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("trial-subscribe-modal")).toBeVisible();

  await page.route("**/api/checkout", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        url: `${new URL(page.url()).origin}/documents/trial`,
      }),
    });
  });

  await page
    .getByTestId("trial-subscribe-modal")
    .getByRole("button", { name: "Continue to secure checkout" })
    .click();

  await expect(page).toHaveURL(/\/documents\/trial/);
  await expect(page.getByLabel("Document title")).toHaveValue("Cancel keeps me");
  await expect(editable).toHaveText(/Still here after cancel/);
});

test("leave-anyway discards the trial draft", async ({ page }) => {
  const email = uniqueEmail("funnel-leave");
  await openTrialEditor(page, email);

  const title = page.getByLabel("Document title");
  await title.fill("Discard on leave");
  await title.blur();
  await page.locator("[contenteditable='true']").click();
  await page.keyboard.type("Gone soon");

  await page.getByRole("link", { name: "Pricing" }).first().click();
  await expect(page.getByTestId("trial-leave-modal")).toBeVisible();
  await page.getByTestId("trial-leave-anyway").click();

  await page.goto("/documents/trial");
  await expect(page.getByLabel("Document title")).toHaveValue(
    "Untitled document",
  );
  await expect(page.locator("[contenteditable='true']")).not.toHaveText(
    /Gone soon/,
  );
});
