import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  document.elementFromPoint = () =>
    document.querySelector("[contenteditable='true']");

  if (typeof DataTransfer === "undefined") {
    class DataTransferStub {
      private data = new Map<string, string>();
      setData(format: string, value: string) {
        this.data.set(format, value);
      }
      getData(format: string) {
        return this.data.get(format) ?? "";
      }
      get types() {
        return [...this.data.keys()];
      }
      files = [] as unknown as FileList;
      items = [] as unknown as DataTransferItemList;
      dropEffect = "none" as DataTransfer["dropEffect"];
      effectAllowed = "all" as DataTransfer["effectAllowed"];
      clearData() {
        this.data.clear();
      }
      setDragImage() {}
    }
    // jsdom lacks DataTransfer; TipTap paste needs clipboardData.getData.
    globalThis.DataTransfer = DataTransferStub as unknown as typeof DataTransfer;
  }

  if (typeof ClipboardEvent === "undefined") {
    class ClipboardEventStub extends Event {
      clipboardData: DataTransfer | null;
      constructor(type: string, init: ClipboardEventInit = {}) {
        super(type, init);
        this.clipboardData = init.clipboardData ?? null;
      }
    }
    globalThis.ClipboardEvent =
      ClipboardEventStub as unknown as typeof ClipboardEvent;
  }
});

async function waitForEditor() {
  await waitFor(() => {
    expect(
      document.querySelector("[contenteditable='true']"),
    ).toBeTruthy();
  });
  const editable = document.querySelector(
    "[contenteditable='true']",
  ) as HTMLElement;
  editable.focus();
  return editable;
}

describe("DocumentEditor (real component)", () => {
  beforeEach(() => {
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
      />,
    );

    await waitForEditor();
    await user.keyboard("Hello");
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
    await waitForEditor();
    await user.keyboard(" more");
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
      />,
    );

    await waitForEditor();

    const cleanEvent = new Event("beforeunload", {
      cancelable: true,
    }) as BeforeUnloadEvent;
    Object.defineProperty(cleanEvent, "returnValue", {
      writable: true,
      value: "",
    });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);

    await user.keyboard("dirty");
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

  it("blocks Save button and Ctrl/Cmd+S when contentAllowed is false", async () => {
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
    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();
    await user.click(saveButton);
    expect(saveDocumentAction).not.toHaveBeenCalled();

    // Ctrl/Cmd+S calls performSave directly — must still no-op when blocked
    // (bites if `|| blocked` is removed from performSave while Save stays disabled).
    await user.keyboard("{Control>}s{/Control}");
    expect(saveDocumentAction).not.toHaveBeenCalled();
    await user.keyboard("{Meta>}s{/Meta}");
    expect(saveDocumentAction).not.toHaveBeenCalled();
  });

  it("strips pasted underline, link, and h1 from editor JSON via ClipboardEvent", async () => {
    const { createProsefieldStarterKit } = await import(
      "@/features/documents/editor-extensions"
    );
    const { Editor } = await import("@tiptap/core");
    const probe = new Editor({
      extensions: [createProsefieldStarterKit()],
      content: EMPTY_DOCUMENT_CONTENT,
    });
    // Attach to the DOM so ClipboardEvent paste is handled like a real editor.
    document.body.appendChild(probe.view.dom);
    probe.commands.focus("end");

    const html =
      "<h1>Title</h1><p><u>under</u> <a href='https://evil.test'>link</a></p>";
    const dt = new DataTransfer();
    dt.setData("text/html", html);
    dt.setData("text/plain", "Title\nunder link");
    const pasted = probe.view.dom.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(pasted).toBe(false);

    await waitFor(() => {
      const serialised = JSON.stringify(probe.getJSON());
      // Positive: paste inserted text (empty doc would vacuously pass negatives).
      expect(serialised).toMatch(/Title|under|link/);
      expect(serialised).not.toMatch(/"underline"/);
      expect(serialised).not.toMatch(/"link"/);
      expect(serialised).not.toMatch(/"level":1/);
    });
    const levels = JSON.stringify(probe.getJSON()).match(/"level":\d+/g) ?? [];
    expect(
      levels.every((entry) => entry === '"level":2' || entry === '"level":3'),
    ).toBe(true);
    probe.view.dom.remove();
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

  it("save flow with headings sends plain JSON Server Actions accept (bug 869fbe1dm)", async () => {
    const user = userEvent.setup();
    const { DocumentEditor } = await import(
      "@/components/editor/document-editor"
    );
    const { documentContentSchema } = await import(
      "@/features/documents/schemas"
    );

    render(
      <DocumentEditor
        documentId="doc1abcABC1234567890"
        initialTitle="Draft"
        initialContent={EMPTY_DOCUMENT_CONTENT}
        contentAllowed
      />,
    );

    await waitForEditor();
    await user.click(screen.getByRole("button", { name: "Heading 2" }));
    await user.keyboard("Section");
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Heading 3" }));
    await user.keyboard("Subsection");

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
    });
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(saveDocumentAction).toHaveBeenCalled();
    });

    const payload = saveDocumentAction.mock.calls.at(-1)?.[0] as {
      content: {
        content?: Array<{ type?: string; attrs?: { level?: number } }>;
      };
    };
    const headingNodes = (payload.content.content ?? []).filter(
      (node) => node.type === "heading",
    );
    expect(headingNodes.length).toBeGreaterThanOrEqual(1);
    for (const node of headingNodes) {
      expect(Object.getPrototypeOf(node.attrs ?? null)).toBe(Object.prototype);
    }
    expect(
      headingNodes.every(
        (node) => node.attrs?.level === 2 || node.attrs?.level === 3,
      ),
    ).toBe(true);
    expect(documentContentSchema.safeParse(payload.content).success).toBe(true);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Saved");
    });
  });
});

describe("schema drift (derived from editor extensions)", () => {
  it("editor nodes/marks equal the allow-lists", async () => {
    const { getSchema } = await import("@tiptap/core");
    const { createProsefieldStarterKit } = await import(
      "@/features/documents/editor-extensions"
    );
    const { ALLOWED_MARK_TYPES, ALLOWED_NODE_TYPES } = await import(
      "@/features/documents/schemas"
    );

    const schema = getSchema([createProsefieldStarterKit()]);
    expect(Object.keys(schema.nodes).sort()).toEqual(
      [...ALLOWED_NODE_TYPES].sort(),
    );
    expect(Object.keys(schema.marks).sort()).toEqual(
      [...ALLOWED_MARK_TYPES].sort(),
    );
  });

  it("every attr the editor can emit is handled by the validator", async () => {
    const { getSchema } = await import("@tiptap/core");
    const { createProsefieldStarterKit } = await import(
      "@/features/documents/editor-extensions"
    );
    const { VALIDATOR_HANDLED_ATTRS } = await import(
      "@/features/documents/schemas"
    );

    const schema = getSchema([createProsefieldStarterKit()]);
    for (const [name, type] of Object.entries(schema.nodes)) {
      expect(Object.keys(type.spec.attrs ?? {}).sort(), name).toEqual(
        [...(VALIDATOR_HANDLED_ATTRS[name] ?? [])].sort(),
      );
    }
    for (const [name, type] of Object.entries(schema.marks)) {
      expect(Object.keys(type.spec.attrs ?? {}), name).toEqual([]);
    }
  });

  it("editor heading levels equal the allowed levels", async () => {
    const { ALLOWED_HEADING_LEVELS, prosefieldStarterKitOptions } =
      await import("@/features/documents/schemas");
    expect([...prosefieldStarterKitOptions.heading.levels]).toEqual([
      ...ALLOWED_HEADING_LEVELS,
    ]);
  });

  it("each editor node type round-trips through the validator", async () => {
    const { Editor } = await import("@tiptap/core");
    const { createProsefieldStarterKit } = await import(
      "@/features/documents/editor-extensions"
    );
    const { assertAllowedTiptapJson, plainTiptapJson } = await import(
      "@/features/documents/schemas"
    );

    const editor = new Editor({
      extensions: [createProsefieldStarterKit()],
      content: EMPTY_DOCUMENT_CONTENT,
    });

    // paragraph + text (default)
    expect(() =>
      assertAllowedTiptapJson(plainTiptapJson(editor.getJSON())),
    ).not.toThrow();

    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "H2", marks: [{ type: "bold" }] }],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "H3", marks: [{ type: "italic" }] }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "bullet" }],
                },
              ],
            },
          ],
        },
        {
          type: "orderedList",
          attrs: { start: 1, type: null },
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "one" }],
                },
              ],
            },
          ],
        },
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "quote" },
                { type: "hardBreak" },
                { type: "text", text: "line" },
              ],
            },
          ],
        },
      ],
    });

    const json = plainTiptapJson(editor.getJSON());
    expect(() => assertAllowedTiptapJson(json)).not.toThrow();
    const types = new Set<string>();
    function walk(node: { type?: string; content?: unknown[] }) {
      if (node.type) {
        types.add(node.type);
      }
      for (const child of node.content ?? []) {
        walk(child as { type?: string; content?: unknown[] });
      }
    }
    walk(json);
    for (const required of [
      "doc",
      "paragraph",
      "heading",
      "bulletList",
      "orderedList",
      "listItem",
      "blockquote",
      "text",
      "hardBreak",
    ]) {
      expect(types.has(required), required).toBe(true);
    }
    editor.destroy();
  });
});
