import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { siteCopy } from "@/content/site";

describe("Sheet", () => {
  it("renders the right-side sheet used by the header", () => {
    render(
      createElement(
        Sheet,
        { open: true },
        createElement(SheetTrigger, null, "Open"),
        createElement(
          SheetContent,
          { side: "right" },
          createElement(SheetHeader, null, createElement(SheetTitle, null, "Menu")),
        ),
      ),
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("sheet-overlay")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: siteCopy.header.closeMenu }),
    ).toBeInTheDocument();
  });

  it("supports the left side variant", () => {
    render(
      createElement(
        Sheet,
        { open: true },
        createElement(
          SheetContent,
          { side: "left" },
          createElement(SheetTitle, null, "Left"),
        ),
      ),
    );
    expect(screen.getByRole("dialog")).toHaveClass("left-0");
  });

  it("applies motion-reduce rules so reduced-motion disables sheet animation", () => {
    render(
      createElement(
        Sheet,
        { open: true },
        createElement(
          SheetContent,
          { side: "right" },
          createElement(SheetTitle, null, "Menu"),
        ),
      ),
    );

    const overlay = screen.getByTestId("sheet-overlay");
    const content = screen.getByTestId("sheet-content");
    expect(overlay.className).toMatch(/motion-reduce:transition-none/);
    expect(overlay.className).toMatch(/motion-reduce:animate-none/);
    expect(content.className).toMatch(/motion-reduce:transition-none/);
    expect(content.className).toMatch(/motion-reduce:animate-none/);
    // Slide/fade animate-in helpers must not remain (they ignore prefers-reduced-motion).
    expect(content.className).not.toMatch(/animate-in|slide-in-from/);
    expect(overlay.className).not.toMatch(/animate-in|fade-in/);
    // Open slide uses theme keyframes + data-state transforms.
    expect(content.className).toMatch(/animate-sheet-in-right|data-\[state=open\]:translate-x-0/);
    expect(content.className).toMatch(/data-\[state=closed\]:translate-x-full/);
  });
});

