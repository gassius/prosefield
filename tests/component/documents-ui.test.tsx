import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveStatusIndicator } from "@/components/editor/save-status";
import { EditorToolbar } from "@/components/editor/toolbar";
import { DocumentList } from "@/components/documents/document-list";
import { EmptyDocuments } from "@/components/documents/empty-documents";
import {
  isSaveHotkey,
  type SaveStatus,
} from "@/features/documents/save-state";

describe("save status aria-live", () => {
  it.each([
    ["saved", "status"],
    ["unsaved", "status"],
    ["saving", "status"],
    ["failed", "alert"],
  ] as const)("%s uses correct live role", (status, role) => {
    render(<SaveStatusIndicator status={status} />);
    expect(screen.getByRole(role)).toHaveAttribute("data-save-status", status);
  });
});

describe("editor toolbar aria-pressed", () => {
  it("exposes aria-pressed on formatting toggles", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const chain = {
      focus: () => chain,
      toggleBold: () => chain,
      run: vi.fn(),
    };
    const editor = {
      isActive: (name: string) => name === "bold",
      chain: () => chain,
      can: () => ({ undo: () => true, redo: () => false }),
    };

    render(
      <EditorToolbar
        editor={editor as never}
        saveStatus={"unsaved" as SaveStatus}
        onSave={onSave}
        isMac={false}
      />,
    );

    const bold = screen.getByRole("button", { name: "Bold" });
    expect(bold).toHaveAttribute("aria-pressed", "true");
    const italic = screen.getByRole("button", { name: "Italic" });
    expect(italic).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Save" }).getAttribute("aria-busy"),
    ).toBeNull();
  });

  it("marks Save aria-busy while saving", () => {
    render(
      <EditorToolbar
        editor={null}
        saveStatus="saving"
        onSave={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
});

describe("document list and empty state", () => {
  it("renders time elements and empty state copy", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const now = new Date("2026-10-02T12:00:00Z");

    const { rerender } = render(
      <DocumentList
        documents={[
          {
            id: "1",
            title: "Project brief",
            updatedAt: "2026-10-02T11:58:00Z",
          },
        ]}
        onCreate={onCreate}
        now={now}
      />,
    );

    const time = screen.getByText(/Edited 2 minutes ago/i);
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime");

    rerender(<EmptyDocuments onCreate={onCreate} />);
    expect(
      screen.getByRole("heading", { name: "Your first page is waiting." }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "New document" }));
    expect(onCreate).toHaveBeenCalled();
  });
});

describe("Ctrl/Cmd+S helper", () => {
  it("matches save hotkey the editor listens for", () => {
    expect(isSaveHotkey({ key: "s", ctrlKey: true, metaKey: false })).toBe(
      true,
    );
  });
});
