import { test, expect } from "@playwright/test";

const WIDTHS = [375, 768, 1024, 1440] as const;

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
      clientWidth: doc.clientWidth,
    };
  });
  expect(
    overflow.scrollWidth,
    `horizontal overflow: scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test.describe("landing marketing surface", () => {
  for (const width of WIDTHS) {
    test(`renders sections without overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "A writing flow with less friction." }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "One plan. Zero clutter." }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Before you start." }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: "Make space for your next good idea.",
        }),
      ).toBeVisible();

      await expect(page.getByText("Private by default")).toBeVisible();
      await expect(page.getByText("One simple plan")).toBeVisible();
      await expect(
        page.getByLabel("Preview of the Prosefield editor"),
      ).toBeAttached();

      if (width < 640) {
        await expect(
          page.getByRole("button", { name: "Open menu" }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Open menu" }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await expect(
          page.getByRole("dialog").getByRole("link", { name: "FAQ" }),
        ).toBeVisible();
        await page.keyboard.press("Escape");
      } else {
        await expect(
          page.getByRole("navigation", { name: "Primary" }),
        ).toBeVisible();
      }

      await expectNoHorizontalOverflow(page);
    });
  }
});
