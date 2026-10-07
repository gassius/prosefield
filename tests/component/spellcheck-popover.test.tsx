import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpellcheckPopover } from "@/components/documents/spellcheck-popover";
import { siteCopy } from "@/content/site";

describe("SpellcheckPopover", () => {
  const anchor = { top: 10, left: 20, width: 40, height: 16 };

  it("shows suggestions, applies one, and ignores spelling", async () => {
    const user = userEvent.setup();
    const onSelectSuggestion = vi.fn();
    const onIgnore = vi.fn();
    const onClose = vi.fn();

    render(
      <SpellcheckPopover
        open
        word="teh"
        suggestions={["the", "tea"]}
        anchor={anchor}
        onSelectSuggestion={onSelectSuggestion}
        onIgnore={onIgnore}
        onClose={onClose}
      />,
    );

    expect(
      screen.getByRole("dialog", {
        name: `${siteCopy.documents.spellcheckPopoverLabelFor} teh`,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "the" }));
    expect(onSelectSuggestion).toHaveBeenCalledWith("the");

    await user.click(
      screen.getByRole("button", {
        name: siteCopy.documents.spellcheckIgnore,
      }),
    );
    expect(onIgnore).toHaveBeenCalled();
  });

  it("closes on Escape and shows empty-suggestions copy", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <SpellcheckPopover
        open
        word="xyzzy"
        suggestions={[]}
        anchor={anchor}
        onSelectSuggestion={vi.fn()}
        onIgnore={vi.fn()}
        onClose={onClose}
      />,
    );
    expect(
      screen.getByText(siteCopy.documents.spellcheckNoSuggestions),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
