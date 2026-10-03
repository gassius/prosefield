import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/content/site", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/content/site")>();
  return {
    ...actual,
    siteCopy: {
      ...actual.siteCopy,
      a11y: {
        ...actual.siteCopy.a11y,
        skipToContent: "SENTINEL-SKIP",
      },
    },
  };
});

vi.mock("next/font/google", () => ({
  DM_Sans: () => ({ variable: "--font-dm-sans" }),
  Fraunces: () => ({ variable: "--font-fraunces" }),
}));

vi.mock("@/components/ui/toaster", () => ({
  Toaster: () => null,
}));

describe("RootLayout skip link copy sentinel", () => {
  it("Skip to content label comes from siteCopy.a11y (sentinel)", async () => {
    const RootLayout = (await import("@/app/layout")).default;
    render(
      createElement(
        RootLayout,
        null,
        createElement("main", { id: "main-content" }, "body"),
      ),
    );
    expect(
      screen.getByRole("link", { name: "SENTINEL-SKIP" }),
    ).toHaveAttribute("href", "#main-content");
  });
});
