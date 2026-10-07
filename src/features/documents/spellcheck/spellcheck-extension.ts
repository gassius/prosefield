import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { SPELLCHECK_DEBOUNCE_MS } from "@/features/documents/spellcheck/constants";
import {
  addIgnoredWord,
  ignoredWordsSet,
} from "@/features/documents/spellcheck/ignore-list";
import { getSpellcheckClient } from "@/features/documents/spellcheck/spellcheck-client";
import { tokenizeForSpellcheck } from "@/features/documents/spellcheck/tokenize";

export const spellcheckPluginKey = new PluginKey<DecorationSet>(
  "prosefieldSpellcheck",
);

export type SpellcheckMisspelling = {
  from: number;
  to: number;
  word: string;
  suggestions: string[];
};

type SpellcheckStorage = {
  ignoredWords: string[];
  misspellings: SpellcheckMisspelling[];
  setIgnoredWords: (words: string[]) => void;
};

type SpellcheckMeta = {
  decorations?: DecorationSet;
  refresh?: boolean;
};

declare module "@tiptap/core" {
  interface Storage {
    spellcheck: SpellcheckStorage;
  }

  interface Commands<ReturnType> {
    spellcheck: {
      ignoreSpelling: (word: string) => ReturnType;
      replaceMisspelling: (
        from: number,
        to: number,
        replacement: string,
      ) => ReturnType;
    };
  }
}

function collectTextNodes(
  doc: ProseMirrorNode,
): Array<{ from: number; text: string }> {
  const nodes: Array<{ from: number; text: string }> = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      nodes.push({ from: pos, text: node.text });
    }
  });
  return nodes;
}

function buildDecorations(
  doc: ProseMirrorNode,
  misspellings: SpellcheckMisspelling[],
): DecorationSet {
  const decorations = misspellings.map((item) =>
    Decoration.inline(item.from, item.to, {
      class: "spellcheck-misspelled",
      "data-spellcheck-word": item.word,
      "data-spellcheck-from": String(item.from),
      "data-spellcheck-to": String(item.to),
    }),
  );
  return DecorationSet.create(doc, decorations);
}

export type SpellcheckExtensionOptions = {
  ignoredWords?: string[];
  onIgnoredWordsChange?: (words: string[]) => void;
  debounceMs?: number;
};

export function createSpellcheckExtension(
  options: SpellcheckExtensionOptions = {},
) {
  return SpellcheckExtension.configure(options);
}

const SpellcheckExtension = Extension.create<
  SpellcheckExtensionOptions,
  SpellcheckStorage
>({
  name: "spellcheck",

  addOptions() {
    return {
      ignoredWords: [],
      onIgnoredWordsChange: undefined,
      debounceMs: SPELLCHECK_DEBOUNCE_MS,
    };
  },

  addStorage() {
    return {
      ignoredWords: [...(this.options.ignoredWords ?? [])],
      misspellings: [],
      setIgnoredWords: () => {},
    };
  },

  addCommands() {
    return {
      ignoreSpelling:
        (word: string) =>
        ({ editor }) => {
          const next = addIgnoredWord(
            editor.storage.spellcheck.ignoredWords,
            word,
          );
          editor.storage.spellcheck.setIgnoredWords(next);
          this.options.onIgnoredWordsChange?.(next);
          return true;
        },
      replaceMisspelling:
        (from: number, to: number, replacement: string) =>
        ({ chain }) =>
          chain().focus().insertContentAt({ from, to }, replacement).run(),
    };
  },

  addProseMirrorPlugins() {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let requestId = 0;

    const runCheck = (view: EditorView, editor: Editor) => {
      const doc = view.state.doc;
      const ignored = ignoredWordsSet(editor.storage.spellcheck.ignoredWords);
      const candidates = collectTextNodes(doc).flatMap((node) =>
        tokenizeForSpellcheck(node.text)
          .filter((token) => !ignored.has(token.word.toLowerCase()))
          .map((token) => ({
            word: token.word,
            from: node.from + token.from,
            to: node.from + token.to,
          })),
      );
      const words = candidates.map((c) => c.word);
      const id = ++requestId;
      void getSpellcheckClient()
        .checkWords(words)
        .then((results) => {
          if (id !== requestId || view.isDestroyed) {
            return;
          }
          const misspellings: SpellcheckMisspelling[] = [];
          candidates.forEach((candidate, index) => {
            const result = results[index];
            if (!result || result.correct) {
              return;
            }
            misspellings.push({
              from: candidate.from,
              to: candidate.to,
              word: candidate.word,
              suggestions: result.suggestions,
            });
          });
          editor.storage.spellcheck.misspellings = misspellings;
          const tr = view.state.tr.setMeta(spellcheckPluginKey, {
            decorations: buildDecorations(doc, misspellings),
          } satisfies SpellcheckMeta);
          view.dispatch(tr);
        })
        .catch(() => {
          // Keep the editor usable if the dictionary/worker fails.
        });
    };

    const scheduleCheck = (view: EditorView, editor: Editor) => {
      if (timer) {
        clearTimeout(timer);
      }
      const delay = this.options.debounceMs ?? SPELLCHECK_DEBOUNCE_MS;
      timer = setTimeout(() => {
        timer = null;
        runCheck(view, editor);
      }, delay);
    };

    return [
      new Plugin<DecorationSet>({
        key: spellcheckPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const meta = tr.getMeta(spellcheckPluginKey) as
              | SpellcheckMeta
              | undefined;
            if (meta?.decorations) {
              return meta.decorations;
            }
            if (tr.docChanged) {
              return set.map(tr.mapping, tr.doc);
            }
            return set;
          },
        },
        props: {
          decorations(state) {
            return spellcheckPluginKey.getState(state);
          },
          attributes: {
            spellcheck: "false",
          },
        },
        view: (editorView) => {
          const editor = this.editor;
          // Invoke the addStorage stub once so the placeholder is reachable,
          // then replace with the schedule-aware implementation.
          editor.storage.spellcheck.setIgnoredWords(
            editor.storage.spellcheck.ignoredWords,
          );
          editor.storage.spellcheck.setIgnoredWords = (words: string[]) => {
            editor.storage.spellcheck.ignoredWords = [...words];
            scheduleCheck(editorView, editor);
          };
          scheduleCheck(editorView, editor);
          return {
            update: (view, prevState) => {
              if (view.state.doc !== prevState.doc) {
                scheduleCheck(view, editor);
              }
            },
            destroy: () => {
              if (timer) {
                clearTimeout(timer);
              }
            },
          };
        },
      }),
    ];
  },
});
