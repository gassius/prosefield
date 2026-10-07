import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSpellcheckPopover } from "@/features/documents/spellcheck/use-spellcheck-popover";
import type { Editor } from "@tiptap/core";

function mockEditor(
  misspellings: Array<{
    from: number;
    to: number;
    word: string;
    suggestions: string[];
  }>,
  options?: { selectionFrom?: number; attachDomSpan?: boolean },
): Editor {
  const dom = document.createElement("div");
  if (options?.attachDomSpan !== false && misspellings[0]) {
    const span = document.createElement("span");
    span.className = "spellcheck-misspelled";
    span.setAttribute("data-spellcheck-word", misspellings[0].word);
    span.setAttribute("data-spellcheck-from", String(misspellings[0].from));
    span.setAttribute("data-spellcheck-to", String(misspellings[0].to));
    span.getBoundingClientRect = () =>
      ({
        top: 10,
        left: 12,
        width: 40,
        height: 16,
        bottom: 26,
        right: 52,
        x: 12,
        y: 10,
        toJSON() {
          return this;
        },
      }) as DOMRect;
    dom.appendChild(span);
  }
  document.body.appendChild(dom);

  const replaceMisspelling = vi.fn(() => ({ run: () => true }));
  const ignoreSpelling = vi.fn(() => ({ run: () => true }));
  const chain = {
    focus: () => chain,
    replaceMisspelling,
    ignoreSpelling,
    run: () => true,
  };

  const selectionFrom =
    options?.selectionFrom ?? misspellings[0]?.from ?? 0;

  return {
    view: {
      dom,
      state: { selection: { from: selectionFrom } },
    },
    state: { selection: { from: selectionFrom } },
    storage: { spellcheck: { misspellings } },
    chain: () => chain,
  } as unknown as Editor;
}

describe("useSpellcheckPopover", () => {
  it("opens on hover and applies suggestion / ignore", () => {
    const editor = mockEditor([
      { from: 1, to: 4, word: "teh", suggestions: ["the"] },
    ]);
    const { result } = renderHook(() => useSpellcheckPopover(editor));

    act(() => {
      editor.view.dom
        .querySelector(".spellcheck-misspelled")!
        .dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });

    expect(result.current.open).toBe(true);
    expect(result.current.misspelling?.word).toBe("teh");

    act(() => {
      result.current.applySuggestion("the");
    });
    expect(result.current.open).toBe(false);

    act(() => {
      editor.view.dom
        .querySelector(".spellcheck-misspelled")!
        .dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    act(() => {
      result.current.ignore();
    });
    expect(result.current.open).toBe(false);

    editor.view.dom.remove();
  });

  it("no-ops when editor is null", () => {
    const { result } = renderHook(() => useSpellcheckPopover(null));
    expect(result.current.open).toBe(false);
    act(() => {
      result.current.applySuggestion("the");
      result.current.ignore();
      result.current.close();
    });
    expect(result.current.open).toBe(false);
  });

  it("ignores mouseover on non-misspelling targets and bad attributes", () => {
    const editor = mockEditor([
      { from: 1, to: 4, word: "teh", suggestions: ["the"] },
    ]);
    const { result } = renderHook(() => useSpellcheckPopover(editor));

    // Non-Element target (text node) → misspellingFromTarget early return.
    const text = document.createTextNode("plain");
    editor.view.dom.appendChild(text);
    act(() => {
      const event = new MouseEvent("mouseover", { bubbles: true });
      Object.defineProperty(event, "target", { value: text });
      editor.view.dom.dispatchEvent(event);
    });
    expect(result.current.open).toBe(false);

    act(() => {
      editor.view.dom.dispatchEvent(
        new MouseEvent("mouseover", { bubbles: true }),
      );
    });
    expect(result.current.open).toBe(false);

    const plain = document.createElement("span");
    plain.textContent = "ok";
    editor.view.dom.appendChild(plain);
    act(() => {
      plain.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    expect(result.current.open).toBe(false);

    const bad = document.createElement("span");
    bad.className = "spellcheck-misspelled";
    bad.setAttribute("data-spellcheck-word", "");
    bad.setAttribute("data-spellcheck-from", "x");
    bad.setAttribute("data-spellcheck-to", "y");
    editor.view.dom.appendChild(bad);
    act(() => {
      bad.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    expect(result.current.open).toBe(false);

    editor.view.dom.remove();
  });

  it("falls back to DOM attributes when storage misspelling is missing", () => {
    const editor = mockEditor([], { attachDomSpan: false });
    const span = document.createElement("span");
    span.className = "spellcheck-misspelled";
    span.setAttribute("data-spellcheck-word", "teh");
    span.setAttribute("data-spellcheck-from", "2");
    span.setAttribute("data-spellcheck-to", "5");
    span.getBoundingClientRect = () =>
      ({
        top: 1,
        left: 2,
        width: 3,
        height: 4,
        bottom: 5,
        right: 5,
        x: 2,
        y: 1,
        toJSON() {
          return this;
        },
      }) as DOMRect;
    editor.view.dom.appendChild(span);

    const { result } = renderHook(() => useSpellcheckPopover(editor));
    act(() => {
      span.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    expect(result.current.open).toBe(true);
    expect(result.current.misspelling).toEqual({
      from: 2,
      to: 5,
      word: "teh",
      suggestions: [],
    });
    editor.view.dom.remove();
  });

  it("opens via ContextMenu / Alt+F7 at the caret", () => {
    const editor = mockEditor([
      { from: 1, to: 4, word: "teh", suggestions: ["the"] },
    ]);
    const { result } = renderHook(() => useSpellcheckPopover(editor));

    act(() => {
      editor.view.dom.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ContextMenu", bubbles: true }),
      );
    });
    expect(result.current.open).toBe(true);
    act(() => result.current.close());

    act(() => {
      editor.view.dom.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "F7",
          altKey: true,
          bubbles: true,
        }),
      );
    });
    expect(result.current.open).toBe(true);

    editor.view.dom.remove();
  });

  it("keyboard open no-ops when caret misses or decoration is gone", () => {
    const editor = mockEditor(
      [{ from: 10, to: 13, word: "teh", suggestions: [] }],
      { selectionFrom: 1, attachDomSpan: false },
    );
    const { result } = renderHook(() => useSpellcheckPopover(editor));
    act(() => {
      editor.view.dom.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ContextMenu", bubbles: true }),
      );
    });
    expect(result.current.open).toBe(false);

    // Caret hits a stored misspelling but DOM decoration is absent.
    const editor2 = mockEditor(
      [{ from: 1, to: 4, word: "teh", suggestions: [] }],
      { selectionFrom: 2, attachDomSpan: false },
    );
    const { result: result2 } = renderHook(() =>
      useSpellcheckPopover(editor2),
    );
    act(() => {
      editor2.view.dom.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ContextMenu", bubbles: true }),
      );
    });
    expect(result2.current.open).toBe(false);
    editor.view.dom.remove();
    editor2.view.dom.remove();
  });

  it("applySuggestion / ignore no-op without an open misspelling", () => {
    const editor = mockEditor([
      { from: 1, to: 4, word: "teh", suggestions: ["the"] },
    ]);
    const { result } = renderHook(() => useSpellcheckPopover(editor));
    act(() => {
      result.current.applySuggestion("the");
      result.current.ignore();
    });
    expect(result.current.open).toBe(false);
    editor.view.dom.remove();
  });
});
