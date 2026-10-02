import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { EMPTY_DOCUMENT_CONTENT } from "@/features/documents/schemas";

const saveDocumentAction = vi.fn();
const renameDocumentAction = vi.fn();
const deleteDocumentAction = vi.fn();

vi.mock("@/features/documents/actions", () => ({
  saveDocumentAction: (...args: unknown[]) => saveDocumentAction(...args),
  renameDocumentAction: (...args: unknown[]) => renameDocumentAction(...args),
  deleteDocumentAction: (...args: unknown[]) => deleteDocumentAction(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));

beforeAll(() => {
  // ProseMirror needs layout APIs that jsdom does not implement.
  const emptyRect = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    toJSON() {
      return this;
    },
  };
  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = () => emptyRect as DOMRect;
  }
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () =>
      ({
        length: 0,
        item: () => null,
        [Symbol.iterator]: function* () {},
      }) as unknown as DOMRectList;
  }
  Element.prototype.getClientRects = () =>
    ({
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* () {},
    }) as unknown as DOMRectList;
  Element.prototype.getBoundingClientRect = () => emptyRect as DOMRect;
});

describe("DocumentEditor (real component)", () => {
  let latestEditor: Editor | null = null;

  beforeEach(() => {
    latestEditor = null;
    saveDocumentAction.mockReset();
    renameDocumentAction.mockReset();
    deleteDocumentAction.mockReset();
    saveDocumentAction.mockResolvedValue({
      ok: true,
      data: { id: "doc1abcABC1234567890", updatedAt: new Date().toISOString() },
    });
    renameDocumentAction.mockResolvedValue({
      ok: true,
      data: { id: "doc1abcABC1234567890", title: "Renamed" },
    });
  });

  it("transitions unsaved → saving → saved and fails to alert", async () => {
    const user = userEvent.setup();
    const { DocumentEditor } = await import(
      "@/components/editor/document-editor"
    );

    let resolveSave: (value: unknown) => void = () => undefined;
    saveDocumentAction.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );

    render(
      <DocumentEditor
        documentId="doc1abcABC1234567890"
        initialTitle="Draft"
        initialContent={EMPTY_DOCUMENT_CONTENT}
        contentAllowed
        onEditorReady={(editor) => {
          latestEditor = editor;
        }}
      />,
    );

    await waitFor(() => {
      expect(latestEditor).toBeTruthy();
    });

    latestEditor!.commands.insertContent("Hello");
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
    });

    const saveClick = user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Saving");
    });
    resolveSave({
      ok: true,
      data: {
        id: "doc1abcABC1234567890",
        updatedAt: new Date().toISOString(),
      },
    });
    await saveClick;
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Saved");
    });

    saveDocumentAction.mockResolvedValueOnce({
      ok: false,
      code: "error",
      message: "fail",
    });
    latestEditor!.commands.insertContent(" more");
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
    });
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Save failed");
    });
  });

  it("Ctrl/Cmd+S saves and beforeunload fires only when dirty", async () => {
    const user = userEvent.setup();
    const { DocumentEditor } = await import(
      "@/components/editor/document-editor"
    );

    render(
      <DocumentEditor
        documentId="doc1abcABC1234567890"
        initialTitle="Draft"
        initialContent={EMPTY_DOCUMENT_CONTENT}
        contentAllowed
        onEditorReady={(editor) => {
          latestEditor = editor;
        }}
      />,
    );

    await waitFor(() => {
      expect(latestEditor).toBeTruthy();
    });

    const cleanEvent = new Event("beforeunload", {
      cancelable: true,
    }) as BeforeUnloadEvent;
    Object.defineProperty(cleanEvent, "returnValue", {
      writable: true,
      value: "",
    });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);

    latestEditor!.commands.insertContent("dirty");
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
    });

    const dirtyEvent = new Event("beforeunload", {
      cancelable: true,
    }) as BeforeUnloadEvent;
    Object.defineProperty(dirtyEvent, "returnValue", {
      writable: true,
      value: "",
    });
    window.dispatchEvent(dirtyEvent);
    expect(
      dirtyEvent.defaultPrevented || dirtyEvent.returnValue !== "",
    ).toBe(true);

    await user.keyboard("{Control>}s{/Control}");
    await waitFor(() => {
      expect(saveDocumentAction).toHaveBeenCalled();
    });
  });

  it("blocks save when contentAllowed is false (no overwrite)", async () => {
    const user = userEvent.setup();
    const { DocumentEditor } = await import(
      "@/components/editor/document-editor"
    );

    render(
      <DocumentEditor
        documentId="doc1abcABC1234567890"
        initialTitle="Draft"
        initialContent={EMPTY_DOCUMENT_CONTENT}
        contentAllowed={false}
      />,
    );

    expect(screen.getByTestId("content-blocked")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(saveDocumentAction).not.toHaveBeenCalled();
  });

  it("strips pasted underline, link, and h1 from editor JSON", async () => {
    const { createProsefieldStarterKit } = await import(
      "@/features/documents/editor-extensions"
    );
    const { Editor } = await import("@tiptap/core");
    const probe = new Editor({
      extensions: [createProsefieldStarterKit()],
      content: EMPTY_DOCUMENT_CONTENT,
    });
    probe.commands.insertContent(
      "<h1>Title</h1><p><u>under</u> <a href='https://evil.test'>link</a></p>",
    );
    const serialised = JSON.stringify(probe.getJSON());
    expect(serialised).not.toMatch(/"underline"/);
    expect(serialised).not.toMatch(/"link"/);
    expect(serialised).not.toMatch(/"level":1/);
    // Heading 1 is demoted or dropped — must not persist as level 1.
    const levels = JSON.stringify(probe.getJSON()).match(/"level":\d+/g) ?? [];
    expect(levels.every((entry) => entry === '"level":2' || entry === '"level":3')).toBe(
      true,
    );
    probe.destroy();
  });

  it("shows rename error from a failed action", async () => {
    const user = userEvent.setup();
    const { DocumentEditor } = await import(
      "@/components/editor/document-editor"
    );
    renameDocumentAction.mockResolvedValueOnce({
      ok: false,
      code: "invalid",
      message: "Title is required",
    });

    render(
      <DocumentEditor
        documentId="doc1abcABC1234567890"
        initialTitle="Draft"
        initialContent={EMPTY_DOCUMENT_CONTENT}
        contentAllowed
      />,
    );

    const title = screen.getByLabelText("Document title");
    await user.clear(title);
    await user.type(title, "Other");
    await user.tab();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Title is required");
    });
  });
});
