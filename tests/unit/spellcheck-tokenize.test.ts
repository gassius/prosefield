import { describe, expect, it } from "vitest";
import {
  shouldSkipToken,
  tokenizeForSpellcheck,
} from "@/features/documents/spellcheck/tokenize";

describe("tokenizeForSpellcheck", () => {
  it("tokenises ordinary words with offsets", () => {
    const tokens = tokenizeForSpellcheck("Hello world");
    expect(tokens).toEqual([
      { word: "Hello", from: 0, to: 5 },
      { word: "world", from: 6, to: 11 },
    ]);
  });

  it("skips URLs, emails, and bare numbers", () => {
    const text = "See https://example.com or a@b.co and 42 please";
    const words = tokenizeForSpellcheck(text).map((t) => t.word);
    expect(words).toEqual(["See", "or", "and", "please"]);
  });

  it("skips ALL-CAPS and words with digits", () => {
    expect(shouldSkipToken("NASA")).toBe(true);
    expect(shouldSkipToken("v2")).toBe(true);
    expect(shouldSkipToken("hello")).toBe(false);
    expect(shouldSkipToken("")).toBe(true);
    // Digit-bearing strings are skipped when passed directly; WORD_RE never
    // emits them, so exercise the shouldSkipToken continue via ALL-CAPS.
    expect(shouldSkipToken("abc123")).toBe(true);
    expect(
      tokenizeForSpellcheck("NASA hello CODE").map((t) => t.word),
    ).toEqual(["hello"]);
  });

  it("keeps apostrophe contractions as one token", () => {
    const tokens = tokenizeForSpellcheck("don't stop");
    expect(tokens.map((t) => t.word)).toEqual(["don't", "stop"]);
  });
});
