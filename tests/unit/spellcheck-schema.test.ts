import { describe, expect, it } from "vitest";
import {
  createDocumentInputSchema,
  IGNORED_WORD_MAX_LENGTH,
  IGNORED_WORDS_MAX,
  ignoredWordsSchema,
  updateDocumentContentBodySchema,
  EMPTY_DOCUMENT_CONTENT,
} from "@/features/documents/schemas";

describe("ignoredWordsSchema", () => {
  it("defaults missing to empty and normalises case", () => {
    expect(ignoredWordsSchema.parse(undefined)).toEqual([]);
    expect(ignoredWordsSchema.parse(["Foo", "foo", " BAR "])).toEqual([
      "foo",
      "bar",
    ]);
  });

  it("rejects over-long words and over-long lists", () => {
    expect(() =>
      ignoredWordsSchema.parse(["x".repeat(IGNORED_WORD_MAX_LENGTH + 1)]),
    ).toThrow();
    const tooMany = Array.from({ length: IGNORED_WORDS_MAX + 1 }, (_, i) =>
      `w${i}`,
    );
    expect(() => ignoredWordsSchema.parse(tooMany)).toThrow();
  });

  it("accepts ignoredWords on create and save bodies", () => {
    const created = createDocumentInputSchema.parse({
      ignoredWords: ["Quux"],
    });
    expect(created.ignoredWords).toEqual(["quux"]);
    expect(created.content).toEqual(EMPTY_DOCUMENT_CONTENT);

    const saved = updateDocumentContentBodySchema.parse({
      content: EMPTY_DOCUMENT_CONTENT,
      ignoredWords: ["Alpha"],
    });
    expect(saved.ignoredWords).toEqual(["alpha"]);
  });
});
