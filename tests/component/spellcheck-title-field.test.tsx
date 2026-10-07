import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpellcheckTitleField } from "@/components/documents/spellcheck-title-field";
import { siteCopy } from "@/content/site";

const checkWords = vi.fn();

vi.mock("@/features/documents/spellcheck/spellcheck-client", () => ({
  getSpellcheckClient: () => ({ checkWords }),
  __resetSpellcheckClientForTests: vi.fn(),
}));

describe("SpellcheckTitleField", () => {
  beforeEach(() => {
    checkWords.mockReset();
    checkWords.mockResolvedValue([
      { word: "teh", correct: false, suggestions: ["the"] },
    ]);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("disables native spellcheck and underlines misspellings", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onChange = vi.fn();
    const onIgnoredWordsChange = vi.fn();

    render(
      <SpellcheckTitleField
        id="title-1"
        label={siteCopy.documents.titleLabel}
        value="teh title"
        onChange={onChange}
        onCommit={vi.fn()}
        ignoredWords={[]}
        onIgnoredWordsChange={onIgnoredWordsChange}
      />,
    );

    const input = screen.getByLabelText(siteCopy.documents.titleLabel);
    expect(input).toHaveAttribute("spellcheck", "false");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    await waitFor(() => {
      expect(checkWords).toHaveBeenCalled();
      expect(document.querySelector(".spellcheck-misspelled")).toHaveTextContent(
        "teh",
      );
    });

    // Mirror uses pointer-events; fire mouseover directly (matches production).
    act(() => {
      document
        .querySelector(".spellcheck-misspelled")!
        .dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    expect(await screen.findByTestId("spellcheck-popover")).toBeInTheDocument();
    await user.click(screen.getByTestId("spellcheck-ignore"));
    expect(onIgnoredWordsChange).toHaveBeenCalledWith(["teh"]);
  });

  it("applies a suggestion into the title value", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onChange = vi.fn();
    render(
      <SpellcheckTitleField
        id="title-2"
        label={siteCopy.documents.titleLabel}
        value="teh"
        onChange={onChange}
        onCommit={vi.fn()}
        ignoredWords={[]}
        onIgnoredWordsChange={vi.fn()}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    await waitFor(() => {
      expect(document.querySelector(".spellcheck-misspelled")).toBeTruthy();
    });
    act(() => {
      document
        .querySelector(".spellcheck-misspelled")!
        .dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    await user.click(screen.getByRole("button", { name: "the" }));
    expect(onChange).toHaveBeenCalledWith("the");
  });

  it("clears misspellings for empty / fully-ignored titles", async () => {
    const { rerender } = render(
      <SpellcheckTitleField
        id="title-empty"
        label={siteCopy.documents.titleLabel}
        value=""
        onChange={vi.fn()}
        onCommit={vi.fn()}
        ignoredWords={[]}
        onIgnoredWordsChange={vi.fn()}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    expect(checkWords).not.toHaveBeenCalled();
    expect(document.querySelector(".spellcheck-misspelled")).toBeNull();

    checkWords.mockResolvedValue([
      { word: "teh", correct: false, suggestions: ["the"] },
    ]);
    rerender(
      <SpellcheckTitleField
        id="title-empty"
        label={siteCopy.documents.titleLabel}
        value="teh"
        onChange={vi.fn()}
        onCommit={vi.fn()}
        ignoredWords={["teh"]}
        onIgnoredWordsChange={vi.fn()}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    expect(checkWords).not.toHaveBeenCalled();
  });

  it("clears decorations when the worker rejects", async () => {
    checkWords.mockRejectedValueOnce(new Error("offline"));
    render(
      <SpellcheckTitleField
        id="title-err"
        label={siteCopy.documents.titleLabel}
        value="teh"
        onChange={vi.fn()}
        onCommit={vi.fn()}
        ignoredWords={[]}
        onIgnoredWordsChange={vi.fn()}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    await waitFor(() => {
      expect(checkWords).toHaveBeenCalled();
    });
    expect(document.querySelector(".spellcheck-misspelled")).toBeNull();
  });

  it("opens via ContextMenu / Alt+F7 and commits on Enter", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onCommit = vi.fn();
    render(
      <SpellcheckTitleField
        id="title-keys"
        label={siteCopy.documents.titleLabel}
        value="teh word"
        onChange={vi.fn()}
        onCommit={onCommit}
        ignoredWords={[]}
        onIgnoredWordsChange={vi.fn()}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    await waitFor(() => {
      expect(document.querySelector(".spellcheck-misspelled")).toBeTruthy();
    });

    const input = screen.getByLabelText(siteCopy.documents.titleLabel);
    await user.click(input);
    // Place caret inside "teh".
    (input as HTMLInputElement).setSelectionRange(1, 1);

    await user.keyboard("{ContextMenu}");
    expect(await screen.findByTestId("spellcheck-popover")).toBeInTheDocument();

    // Close then try Alt+F7
    await user.keyboard("{Escape}");
    await user.keyboard("{Alt>}{F7}{/Alt}");
    expect(await screen.findByTestId("spellcheck-popover")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(onCommit).toHaveBeenCalledWith("teh word");
  });

  it("keyboard open no-ops when caret misses a misspelling", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <SpellcheckTitleField
        id="title-miss"
        label={siteCopy.documents.titleLabel}
        value="teh word"
        onChange={vi.fn()}
        onCommit={vi.fn()}
        ignoredWords={[]}
        onIgnoredWordsChange={vi.fn()}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    await waitFor(() => {
      expect(document.querySelector(".spellcheck-misspelled")).toBeTruthy();
    });
    const input = screen.getByLabelText(siteCopy.documents.titleLabel);
    await user.click(input);
    (input as HTMLInputElement).setSelectionRange(6, 6);
    await user.keyboard("{ContextMenu}");
    expect(screen.queryByTestId("spellcheck-popover")).toBeNull();
  });

  it("ignores mouseover on non-misspelling mirror targets", async () => {
    render(
      <SpellcheckTitleField
        id="title-hover"
        label={siteCopy.documents.titleLabel}
        value="teh ok"
        onChange={vi.fn()}
        onCommit={vi.fn()}
        ignoredWords={[]}
        onIgnoredWordsChange={vi.fn()}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    await waitFor(() => {
      expect(document.querySelector(".spellcheck-misspelled")).toBeTruthy();
    });
    const mirror = document.querySelector(
      '[aria-hidden] .pointer-events-auto',
    );
    expect(mirror).toBeTruthy();
    act(() => {
      mirror!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    expect(screen.queryByTestId("spellcheck-popover")).toBeNull();
  });

  it("commits on blur", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onCommit = vi.fn();
    render(
      <SpellcheckTitleField
        id="title-blur"
        label={siteCopy.documents.titleLabel}
        value="hello"
        onChange={vi.fn()}
        onCommit={onCommit}
        ignoredWords={[]}
        onIgnoredWordsChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText(siteCopy.documents.titleLabel);
    await user.click(input);
    await user.tab();
    expect(onCommit).toHaveBeenCalledWith("hello");
  });

  it("skips correct words and cancelled in-flight checks", async () => {
    checkWords.mockResolvedValue([
      { word: "teh", correct: true, suggestions: [] },
      { word: "word", correct: true, suggestions: [] },
    ]);
    const { rerender, unmount } = render(
      <SpellcheckTitleField
        id="title-correct"
        label={siteCopy.documents.titleLabel}
        value="teh word"
        onChange={vi.fn()}
        onCommit={vi.fn()}
        ignoredWords={[]}
        onIgnoredWordsChange={vi.fn()}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    await waitFor(() => expect(checkWords).toHaveBeenCalled());
    expect(document.querySelector(".spellcheck-misspelled")).toBeNull();

    // Change value before debounce fires → cleanup cancels prior timer.
    checkWords.mockClear();
    checkWords.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve([{ word: "zzz", correct: false, suggestions: ["zzz"] }]),
            50,
          );
        }),
    );
    rerender(
      <SpellcheckTitleField
        id="title-correct"
        label={siteCopy.documents.titleLabel}
        value="zzz"
        onChange={vi.fn()}
        onCommit={vi.fn()}
        ignoredWords={[]}
        onIgnoredWordsChange={vi.fn()}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    // Unmount while in flight to hit cancelled=true after await.
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
  });
});
