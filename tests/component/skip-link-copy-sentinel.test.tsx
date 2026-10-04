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

const connection = vi.fn(async () => undefined);

vi.mock("next/server", () => ({
  connection: () => connection(),
}));

describe("RootLayout skip link copy sentinel", () => {
  it("Skip to content label comes from siteCopy.a11y (sentinel)", async () => {
    connection.mockClear();
    const RootLayout = (await import("@/app/layout")).default;
    const tree = await RootLayout({
      children: createElement("main", { id: "main-content" }, "body"),
    });
    render(tree);
    expect(
      screen.getByRole("link", { name: "SENTINEL-SKIP" }),
    ).toHaveAttribute("href", "#main-content");
  });

  it("awaits connection() so /_not-found stays dynamic for nonce CSP (N12)", async () => {
    connection.mockClear();
    const RootLayout = (await import("@/app/layout")).default;
    await RootLayout({
      children: createElement("main", { id: "main-content" }, "body"),
    });
    expect(connection).toHaveBeenCalled();
  });
});
