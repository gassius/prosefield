import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { createProsefieldStarterKit } from "@/features/documents/editor-extensions";
import {
  DOCUMENT_CONTENT_MAX_DEPTH,
  assertAllowedTiptapJson,
  documentContentSchema,
  plainTiptapJson,
  type TiptapJson,
} from "@/features/documents/schemas";

/** TipTap node nesting depth (content children only; root = 0). */
function tipTapNodeDepth(node: TiptapJson, depth = 0): number {
  let max = depth;
  for (const child of node.content ?? []) {
    max = Math.max(max, tipTapNodeDepth(child, depth + 1));
  }
  return max;
}

function createEditor(content: string | TiptapJson = "<p>x</p>") {
  return new Editor({
    extensions: [createProsefieldStarterKit()],
    content,
  });
}

/** Place the caret inside the last list-item paragraph (not a trailing empty p). */
function focusLastListItem(editor: Editor): void {
  let target = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "listItem") {
      // caret inside the list item's first textblock
      target = pos + 2;
    }
  });
  expect(target).toBeGreaterThan(0);
  editor.commands.setTextSelection(target);
}

/**
 * Nest list items via the same commands Tab uses (`splitListItem` +
 * `sinkListItem`) until the deepest node reaches `targetDepth`.
 * Inserts text after each sink so the new item stays sinkable.
 */
function nestListToNodeDepth(editor: Editor, targetDepth: number): void {
  editor.commands.setContent("<ul><li><p>a</p></li><li><p>deep</p></li></ul>");
  focusLastListItem(editor);
  let guard = 0;
  while (tipTapNodeDepth(editor.getJSON() as TiptapJson) < targetDepth) {
    expect(editor.commands.splitListItem("listItem")).toBe(true);
    expect(editor.commands.sinkListItem("listItem")).toBe(true);
    editor.commands.insertContent("x");
    guard += 1;
    expect(guard).toBeLessThan(DOCUMENT_CONTENT_MAX_DEPTH + 8);
  }
}

describe("document schema ↔ real editor nesting", () => {
  it("accepts editor-emitted nesting at the documented node-depth limit with bold/italic", () => {
    const editor = createEditor();
    nestListToNodeDepth(editor, DOCUMENT_CONTENT_MAX_DEPTH);
    // Select the deepest text and mark it (toolbar-equivalent).
    let markFrom = -1;
    let markTo = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === "x") {
        markFrom = pos;
        markTo = pos + node.nodeSize;
      }
    });
    expect(markFrom).toBeGreaterThan(0);
    editor
      .chain()
      .setTextSelection({ from: markFrom, to: markTo })
      .setBold()
      .setItalic()
      .run();

    const json = plainTiptapJson(editor.getJSON());
    expect(tipTapNodeDepth(json)).toBe(DOCUMENT_CONTENT_MAX_DEPTH);
    expect(JSON.stringify(json)).toMatch(/"bold"/);
    expect(JSON.stringify(json)).toMatch(/"italic"/);

    const parsed = documentContentSchema.parse(json);
    expect(parsed).toEqual(assertAllowedTiptapJson(json));
    expect(parsed.type).toBe("doc");
    editor.destroy();
  });

  it("accepts editor wrapIn(blockquote) nesting at the documented node-depth limit with marks", () => {
    const editor = createEditor("<p>quoted</p>");
    // text depth = blockquotes + 2 (paragraph + text); stop at max depth.
    const wraps = DOCUMENT_CONTENT_MAX_DEPTH - 2;
    for (let i = 0; i < wraps; i += 1) {
      expect(editor.commands.wrapIn("blockquote")).toBe(true);
    }
    let markFrom = -1;
    let markTo = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === "quoted") {
        markFrom = pos;
        markTo = pos + node.nodeSize;
      }
    });
    expect(markFrom).toBeGreaterThan(0);
    editor
      .chain()
      .setTextSelection({ from: markFrom, to: markTo })
      .setBold()
      .setItalic()
      .run();

    const json = plainTiptapJson(editor.getJSON());
    expect(tipTapNodeDepth(json)).toBe(DOCUMENT_CONTENT_MAX_DEPTH);
    expect(JSON.stringify(json)).toMatch(/"bold"/);
    expect(JSON.stringify(json)).toMatch(/"italic"/);
    expect(documentContentSchema.safeParse(json).success).toBe(true);
    expect(assertAllowedTiptapJson(json).type).toBe("doc");
    editor.destroy();
  });

  it("rejects editor nesting one node past the documented limit", () => {
    const editor = createEditor();
    nestListToNodeDepth(editor, DOCUMENT_CONTENT_MAX_DEPTH + 1);
    const json = plainTiptapJson(editor.getJSON());
    expect(tipTapNodeDepth(json)).toBeGreaterThan(DOCUMENT_CONTENT_MAX_DEPTH);
    expect(() => assertAllowedTiptapJson(json)).toThrow(/maximum nesting depth/);
    expect(documentContentSchema.safeParse(json).success).toBe(false);
    editor.destroy();
  });

  it("keeps a representative existing valid document valid (from editor.getJSON)", () => {
    const editor = createEditor();
    editor.commands.setContent(
      [
        "<h2>Chapter</h2>",
        "<h3>Section</h3>",
        "<p>Lead-in<br>continued</p>",
        "<ul><li><p>bullet</p></li></ul>",
        "<ol><li><p>first</p></li></ol>",
        "<blockquote><p>quoted</p></blockquote>",
      ].join(""),
    );

    // Apply marks the way the toolbar does on concrete ranges.
    const { doc } = editor.state;
    let chapterFrom = -1;
    let chapterTo = -1;
    let sectionFrom = -1;
    let sectionTo = -1;
    doc.descendants((node, pos) => {
      if (node.isText && node.text === "Chapter") {
        chapterFrom = pos;
        chapterTo = pos + node.nodeSize;
      }
      if (node.isText && node.text === "Section") {
        sectionFrom = pos;
        sectionTo = pos + node.nodeSize;
      }
    });
    expect(chapterFrom).toBeGreaterThan(0);
    expect(sectionFrom).toBeGreaterThan(0);
    editor.chain().setTextSelection({ from: chapterFrom, to: chapterTo }).setBold().run();
    editor
      .chain()
      .setTextSelection({ from: sectionFrom, to: sectionTo })
      .setItalic()
      .run();

    const fromEditor = plainTiptapJson(editor.getJSON());
    // TipTap may append a trailing empty paragraph; keep allow-listed blocks.
    const content = (fromEditor.content ?? []).filter(
      (node) =>
        !(
          node.type === "paragraph" &&
          (node.content === undefined || node.content.length === 0)
        ),
    );
    const representative: TiptapJson = { type: "doc", content };
    expect(representative.content?.map((node) => node.type)).toEqual([
      "heading",
      "heading",
      "paragraph",
      "bulletList",
      "orderedList",
      "blockquote",
    ]);

    const parsed = documentContentSchema.parse(representative);
    // Sanitised form is exact: nothing extra survives; orderedList drops type:null.
    expect(parsed).toEqual(assertAllowedTiptapJson(representative));
    expect(parsed.content?.[0]).toEqual({
      type: "heading",
      attrs: { level: 2 },
      content: [
        {
          type: "text",
          text: "Chapter",
          marks: [{ type: "bold" }],
        },
      ],
    });
    expect(assertAllowedTiptapJson(parsed)).toEqual(parsed);
    editor.destroy();
  });
});
