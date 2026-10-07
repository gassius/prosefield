import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import { createProsefieldStarterKit } from "@/features/documents/editor-extensions";
import { createSpellcheckExtension } from "@/features/documents/spellcheck/spellcheck-extension";

const checkWords = vi.fn();

vi.mock("@/features/documents/spellcheck/spellcheck-client", () => ({
  getSpellcheckClient: () => ({ checkWords }),
  __resetSpellcheckClientForTests: vi.fn(),
}));

beforeAll(() => {
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

describe("SpellcheckExtension", () => {
  beforeEach(() => {
    checkWords.mockReset();
    checkWords.mockResolvedValue([
      { word: "mispelled", correct: false, suggestions: ["misspelled"] },
    ]);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("decorates misspellings, replaces, and ignores", async () => {
    const onIgnoredWordsChange = vi.fn();
    const element = document.createElement("div");
    document.body.appendChild(element);

    const editor = new Editor({
      element,
      extensions: [
        createProsefieldStarterKit(),
        createSpellcheckExtension({
          debounceMs: 10,
          onIgnoredWordsChange,
        }),
      ],
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "mispelled word" }],
          },
        ],
      },
    });

    await vi.advanceTimersByTimeAsync(20);
    await vi.waitFor(() => {
      expect(checkWords).toHaveBeenCalled();
      expect(editor.storage.spellcheck.misspellings.length).toBeGreaterThan(0);
    });

    const hit = editor.storage.spellcheck.misspellings[0]!;
    expect(hit.word).toBe("mispelled");

    editor.commands.replaceMisspelling(hit.from, hit.to, "misspelled");
    expect(editor.getText()).toContain("misspelled");

    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "mispelled again" }],
        },
      ],
    });
    await vi.advanceTimersByTimeAsync(20);
    await vi.waitFor(() => {
      expect(
        editor.storage.spellcheck.misspellings.some((m) => m.word === "mispelled"),
      ).toBe(true);
    });

    editor.commands.ignoreSpelling("mispelled");
    expect(onIgnoredWordsChange).toHaveBeenCalled();
    expect(editor.storage.spellcheck.ignoredWords).toContain("mispelled");

    editor.destroy();
    element.remove();
  });

  it("drops stale check results and survives worker failures", async () => {
    let resolveFirst!: (value: unknown) => void;
    const first = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    checkWords
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce([
        { word: "mispelled", correct: false, suggestions: ["misspelled"] },
      ])
      .mockRejectedValueOnce(new Error("offline"));

    const element = document.createElement("div");
    document.body.appendChild(element);
    const editor = new Editor({
      element,
      extensions: [
        createProsefieldStarterKit(),
        createSpellcheckExtension({ debounceMs: 10 }),
      ],
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "mispelled" }],
          },
        ],
      },
    });

    await vi.advanceTimersByTimeAsync(20);
    // Trigger a second check before the first resolves → first becomes stale.
    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "mispelled again" }],
        },
      ],
    });
    await vi.advanceTimersByTimeAsync(20);
    resolveFirst([
      { word: "mispelled", correct: false, suggestions: ["misspelled"] },
    ]);
    await vi.advanceTimersByTimeAsync(5);
    await vi.waitFor(() => {
      expect(checkWords.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    // Worker rejection is swallowed.
    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "anothr" }],
        },
      ],
    });
    await vi.advanceTimersByTimeAsync(20);
    await vi.waitFor(() => {
      expect(checkWords.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    // Destroy while a check is in flight → view.isDestroyed branch.
    checkWords.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve([
                { word: "zzz", correct: false, suggestions: ["zzz"] },
              ]),
            30,
          );
        }),
    );
    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "zzz" }],
        },
      ],
    });
    await vi.advanceTimersByTimeAsync(15);
    editor.destroy();
    await vi.advanceTimersByTimeAsync(50);
    element.remove();
  });

  it("skips correct results and applies setIgnoredWords", async () => {
    checkWords.mockResolvedValue([
      { word: "hello", correct: true, suggestions: [] },
    ]);
    const element = document.createElement("div");
    document.body.appendChild(element);
    const editor = new Editor({
      element,
      extensions: [
        createProsefieldStarterKit(),
        createSpellcheckExtension({
          debounceMs: 10,
          ignoredWords: ["seed"],
        }),
      ],
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "hello" }],
          },
        ],
      },
    });
    await vi.advanceTimersByTimeAsync(20);
    await vi.waitFor(() => expect(checkWords).toHaveBeenCalled());
    expect(editor.storage.spellcheck.misspellings).toEqual([]);
    expect(editor.storage.spellcheck.ignoredWords).toContain("seed");
    editor.storage.spellcheck.setIgnoredWords(["seed", "extra"]);
    expect(editor.storage.spellcheck.ignoredWords).toEqual(["seed", "extra"]);
    await vi.advanceTimersByTimeAsync(20);
    editor.destroy();
    element.remove();
  });

  it("uses default debounce and ignoredWords options", async () => {
    checkWords.mockResolvedValue([]);
    const element = document.createElement("div");
    document.body.appendChild(element);
    // No debounceMs / ignoredWords — hits option defaults (?? branches).
    const editor = new Editor({
      element,
      extensions: [
        createProsefieldStarterKit(),
        createSpellcheckExtension(),
      ],
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "hi" }],
          },
        ],
      },
    });
    await vi.advanceTimersByTimeAsync(400);
    await vi.waitFor(() => expect(checkWords).toHaveBeenCalled());
    expect(editor.storage.spellcheck.ignoredWords).toEqual([]);
    editor.destroy();
    element.remove();
  });
});
