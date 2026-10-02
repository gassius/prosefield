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

  test("skip link targets main; icon and apple-touch links return 200", async ({
    page,
  }) => {
    await page.goto("/");

    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toHaveAttribute("href", "#main-content");
    await expect(page.locator("main#main-content")).toHaveCount(1);

    const iconHref = await page
      .locator('link[rel="icon"][href*="icon"]')
      .first()
      .getAttribute("href");
    expect(iconHref).toBeTruthy();
    const iconRes = await page.request.get(
      new URL(iconHref!, page.url()).toString(),
    );
    expect(iconRes.status()).toBe(200);

    const appleHref = await page
      .locator('link[rel="apple-touch-icon"]')
      .first()
      .getAttribute("href");
    expect(appleHref).toBeTruthy();
    const appleRes = await page.request.get(
      new URL(appleHref!, page.url()).toString(),
    );
    expect(appleRes.status()).toBe(200);
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

    const motion = await content.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        animationName: style.animationName,
        animationDuration: style.animationDuration,
      };
    });
    // Prefer none; also accept ≤10ms duration under the global reduced-motion rule.
    const durationMs = Number.parseFloat(motion.animationDuration) * 1000;
    expect(
      motion.animationName === "none" ||
        motion.animationName === "" ||
        durationMs <= 10,
    ).toBe(true);

    const chevron = page
      .getByRole("button", { name: "Are my documents private?" })
      .locator('[data-testid="faq-chevron"]');
    const chevronTransition = await chevron.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        duration: style.transitionDuration,
        property: style.transitionProperty,
      };
    });
    const chevronMs = Number.parseFloat(chevronTransition.duration) * 1000;
    expect(chevronMs <= 10 || chevronTransition.property === "none").toBe(true);
  });
});
