import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

describe("DropdownMenu", () => {
  it("supports inset menu items", async () => {
    const user = userEvent.setup();
    render(
      createElement(
        DropdownMenu,
        null,
        createElement(DropdownMenuTrigger, null, "Open"),
        createElement(
          DropdownMenuContent,
          null,
          createElement(DropdownMenuItem, { inset: true }, "Inset item"),
        ),
      ),
    );

    await user.click(screen.getByRole("button", { name: "Open" }));
    const item = await screen.findByRole("menuitem", { name: "Inset item" });
    expect(item.className).toContain("pl-8");
  });
});
