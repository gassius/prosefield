import { createElement } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

describe("DropdownMenu", () => {
  it("opens a menu with menuitem roles and supports inset items", async () => {
    const user = userEvent.setup();
    render(
      createElement(
        DropdownMenu,
        { modal: false },
        createElement(DropdownMenuTrigger, null, "Open"),
        createElement(
          DropdownMenuContent,
          null,
          createElement(DropdownMenuItem, { inset: true }, "Inset item"),
        ),
      ),
    );

    const trigger = screen.getByRole("button", { name: "Open" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = await screen.findByRole("menu");
    const item = within(menu).getByRole("menuitem", { name: "Inset item" });
    expect(item.className).toContain("pl-8");
  });
});
