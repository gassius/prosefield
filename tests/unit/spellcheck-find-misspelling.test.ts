import { describe, expect, it } from "vitest";
import { findMisspellingAt } from "@/features/documents/spellcheck/find-misspelling-at";

describe("findMisspellingAt", () => {
  const items = [
    { from: 5, to: 10, word: "teh", suggestions: ["the"] },
    { from: 20, to: 28, word: "mispelled", suggestions: ["misspelled"] },
  ];

  it("finds covering range and end-of-word caret", () => {
    expect(findMisspellingAt(items, 7)?.word).toBe("teh");
    expect(findMisspellingAt(items, 10)?.word).toBe("teh");
    expect(findMisspellingAt(items, 4)).toBeNull();
  });
});
