import { describe, expect, it } from "vitest";
import {
  addIgnoredWord,
  isWordIgnored,
  normaliseIgnoredWord,
} from "@/features/documents/spellcheck/ignore-list";
import { IGNORED_WORDS_MAX } from "@/features/documents/spellcheck/constants";

describe("ignore-list", () => {
  it("normalises case for matching", () => {
    expect(normaliseIgnoredWord(" TeSt ")).toBe("test");
    expect(isWordIgnored("TEST", ["test"])).toBe(true);
    expect(isWordIgnored("other", ["test"])).toBe(false);
  });

  it("dedupes case-insensitively when adding", () => {
    expect(addIgnoredWord(["foo"], "FOO")).toEqual(["foo"]);
    expect(addIgnoredWord(["foo"], "Bar")).toEqual(["foo", "bar"]);
  });

  it("rejects empty and over-long words", () => {
    expect(addIgnoredWord([], "   ")).toEqual([]);
    expect(addIgnoredWord([], "x".repeat(65))).toEqual([]);
  });

  it("caps the list at IGNORED_WORDS_MAX", () => {
    const full = Array.from({ length: IGNORED_WORDS_MAX }, (_, i) => `w${i}`);
    expect(addIgnoredWord(full, "extra")).toEqual(full);
  });
});
