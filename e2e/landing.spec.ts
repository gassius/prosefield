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

async function expectReducedMotion(
  locator: import("@playwright/test").Locator,
) {
  const motion = await locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      transitionDuration: style.transitionDuration,
      transitionProperty: style.transitionProperty,
    };
  });
  const animMs = Number.parseFloat(motion.animationDuration) * 1000;
  const transitionMs = Number.parseFloat(motion.transitionDuration) * 1000;
  expect(
    motion.animationName === "none" ||
      motion.animationName === "" ||
      Number.isNaN(animMs) ||
      animMs <= 10,
  ).toBe(true);
  expect(
    motion.transitionProperty === "none" ||
      Number.isNaN(transitionMs) ||
      transitionMs <= 10,
  ).toBe(true);
}

test.describe("landing marketing surface", () => {
  for (const width of WIDTHS) {
    test(`renders sections without overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");

      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeVisible();

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

  test("skip link targets main; every brand icon link returns 200", async ({
    page,
  }) => {
    await page.goto("/");

    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toHaveAttribute("href", "#main-content");
    await expect(page.locator("main#main-content")).toHaveCount(1);

    const expectedIcons: Array<{
      rel: string;
      hrefIncludes: string;
      type?: string;
    }> = [
      { rel: "icon", hrefIncludes: "favicon.ico" },
      { rel: "icon", hrefIncludes: "icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", hrefIncludes: "apple-icon" },
    ];

    for (const expected of expectedIcons) {
      const locator = expected.type
        ? page.locator(
            `link[rel="${expected.rel}"][type="${expected.type}"][href*="${expected.hrefIncludes}"]`,
          )
        : page.locator(
            `link[rel="${expected.rel}"][href*="${expected.hrefIncludes}"]`,
          );
      await expect(locator.first()).toHaveCount(1);
      const href = await locator.first().getAttribute("href");
      expect(href).toBeTruthy();
      const res = await page.request.get(new URL(href!, page.url()).toString());
      expect(res.status(), `${expected.hrefIncludes} should return 200`).toBe(
        200,
      );
    }
  });

  test("FAQ accordion honours prefers-reduced-motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");

    await page.getByRole("button", { name: "Are my documents private?" }).click();
    const content = page.locator(
      '[data-testid="faq-accordion-content"][data-state="open"]',
    );
    await expect(content).toBeVisible();
    await expectReducedMotion(content);

    const chevron = page
      .getByRole("button", { name: "Are my documents private?" })
      .locator('[data-testid="faq-chevron"]');
    await expectReducedMotion(chevron);
  });

  test("Sheet honours prefers-reduced-motion at 375px", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    await page.getByRole("button", { name: "Open menu" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expectReducedMotion(dialog);

    const overlay = page.getByTestId("sheet-overlay");
    await expect(overlay).toBeVisible();
    await expectReducedMotion(overlay);
  });
});
