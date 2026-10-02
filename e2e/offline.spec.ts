import { test, expect } from "@playwright/test";

/**
 * Host-only frontend rule: marketing must render with the backend down.
 * Tag @offline so CI can run this before (or without) docker compose.
 */
test("landing page renders with the backend down @offline", async ({
  page,
}) => {
  // Force a failure if someone accidentally points Auth at a live host without the page loading.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", {
      name: "Turn scattered thoughts into something worth reading.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Prosefield home" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Start your first page" }).first(),
  ).toBeVisible();
});
